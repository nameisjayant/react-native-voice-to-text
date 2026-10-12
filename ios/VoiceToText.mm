#import "VoiceToText.h"

#import <AVFoundation/AVFoundation.h>
#import <Speech/Speech.h>

static NSString *const kErrorPermission = @"permission_denied";
static NSString *const kErrorUnavailable = @"unavailable";
static NSString *const kErrorStart = @"start_failed";

@implementation VoiceToText {
  // All state below is only touched on the main queue.
  AVAudioEngine *_audioEngine;
  SFSpeechRecognizer *_recognizer;
  SFSpeechAudioBufferRecognitionRequest *_request;
  SFSpeechRecognitionTask *_task;
  NSString *_lastTranscript;
  BOOL _sessionActive;
  BOOL _audioSessionActivated;
  CFTimeInterval _lastVolumeEmit;
}

+ (NSString *)moduleName
{
  return @"VoiceToText";
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeVoiceToTextSpecJSI>(params);
}

- (void)invalidate
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self teardownCancellingTask:YES];
  });
}

#pragma mark - Permissions

- (BOOL)microphoneGranted
{
  if (@available(iOS 17.0, *)) {
    return [AVAudioApplication sharedInstance].recordPermission == AVAudioApplicationRecordPermissionGranted;
  }
  return [AVAudioSession sharedInstance].recordPermission == AVAudioSessionRecordPermissionGranted;
}

- (BOOL)permissionsGranted
{
  return [SFSpeechRecognizer authorizationStatus] == SFSpeechRecognizerAuthorizationStatusAuthorized &&
      [self microphoneGranted];
}

- (void)isAvailable:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  SFSpeechRecognizer *recognizer = [[SFSpeechRecognizer alloc] init];
  resolve(@(recognizer != nil && recognizer.isAvailable));
}

- (void)hasPermissions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([self permissionsGranted]));
}

- (void)requestPermissions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
    if (status != SFSpeechRecognizerAuthorizationStatusAuthorized) {
      resolve(@NO);
      return;
    }
    void (^micHandler)(BOOL) = ^(BOOL granted) {
      resolve(@(granted));
    };
    if (@available(iOS 17.0, *)) {
      [AVAudioApplication requestRecordPermissionWithCompletionHandler:micHandler];
    } else {
      [[AVAudioSession sharedInstance] requestRecordPermission:micHandler];
    }
  }];
}

#pragma mark - Listening

- (void)startListening:(NSDictionary *)options
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (![self permissionsGranted]) {
      reject(kErrorPermission, @"Speech recognition or microphone permission has not been granted", nil);
      return;
    }

    [self teardownCancellingTask:YES];

    id localeOption = options[@"locale"];
    SFSpeechRecognizer *recognizer = [localeOption isKindOfClass:[NSString class]]
        ? [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:localeOption]]
        : [[SFSpeechRecognizer alloc] init];
    if (recognizer == nil || !recognizer.isAvailable) {
      reject(kErrorUnavailable, @"Speech recognition is not available for this locale", nil);
      return;
    }

    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
// AllowBluetooth was renamed AllowBluetoothHFP (same value) in newer SDKs; keep the old name so older Xcodes build.
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    [session setCategory:AVAudioSessionCategoryPlayAndRecord
                    mode:AVAudioSessionModeMeasurement
                 options:AVAudioSessionCategoryOptionDuckOthers | AVAudioSessionCategoryOptionDefaultToSpeaker |
                         AVAudioSessionCategoryOptionAllowBluetooth
                   error:&error];
#pragma clang diagnostic pop
    if (error == nil) {
      [session setActive:YES withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&error];
    }
    if (error != nil) {
      reject(kErrorStart, error.localizedDescription, error);
      return;
    }
    self->_audioSessionActivated = YES;

    SFSpeechAudioBufferRecognitionRequest *request = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    request.shouldReportPartialResults = YES;
    if ([options[@"onDevice"] boolValue] && recognizer.supportsOnDeviceRecognition) {
      request.requiresOnDeviceRecognition = YES;
    }

    AVAudioEngine *engine = [[AVAudioEngine alloc] init];
    AVAudioInputNode *inputNode = engine.inputNode;
    AVAudioFormat *format = [inputNode outputFormatForBus:0];
    if (format.sampleRate <= 0 || format.channelCount == 0) {
      [self teardownCancellingTask:YES];
      reject(kErrorStart, @"No audio input available", nil);
      return;
    }

    __weak VoiceToText *weakSelf = self;
    [inputNode installTapOnBus:0
                    bufferSize:1024
                        format:format
                         block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
                           [request appendAudioPCMBuffer:buffer];
                           [weakSelf handleAudioLevel:buffer];
                         }];

    self->_recognizer = recognizer;
    self->_request = request;
    self->_audioEngine = engine;
    self->_lastTranscript = @"";
    self->_sessionActive = YES;

    SFSpeechRecognitionTask *task =
        [recognizer recognitionTaskWithRequest:request
                                 resultHandler:^(SFSpeechRecognitionResult *result, NSError *taskError) {
                                   dispatch_async(dispatch_get_main_queue(), ^{
                                     [weakSelf handleTask:request result:result error:taskError];
                                   });
                                 }];
    self->_task = task;

    [engine prepare];
    if (![engine startAndReturnError:&error]) {
      [self teardownCancellingTask:YES];
      reject(kErrorStart, error.localizedDescription ?: @"Failed to start audio engine", error);
      return;
    }

    [self emitOnSpeechState:@{@"state" : @"started"}];
    resolve(nil);
  });
}

- (void)stopListening:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    // Stop capturing; the recognition task then delivers its final result.
    [self stopAudio];
    [self->_request endAudio];
    resolve(nil);
  });
}

- (void)cancelListening:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self teardownCancellingTask:YES];
    resolve(nil);
  });
}

#pragma mark - Callbacks

- (void)handleTask:(SFSpeechAudioBufferRecognitionRequest *)request
            result:(SFSpeechRecognitionResult *)result
             error:(NSError *)error
{
  // Ignore callbacks from a session that has already been replaced or cancelled.
  if (!_sessionActive || request != _request) {
    return;
  }

  if (result != nil) {
    NSString *text = result.bestTranscription.formattedString ?: @"";
    BOOL changed = ![text isEqualToString:_lastTranscript];
    _lastTranscript = text;
    if (changed || result.isFinal) {
      [self emitOnSpeechResult:@{@"value" : text, @"isFinal" : @(result.isFinal)}];
    }
    if (result.isFinal) {
      [self finishSession];
      return;
    }
  }

  if (error != nil) {
    // 1110 = no speech detected
    BOOL noSpeech = [error.domain isEqualToString:@"kAFAssistantErrorDomain"] && error.code == 1110;
    if (_lastTranscript.length > 0) {
      [self emitOnSpeechResult:@{@"value" : _lastTranscript, @"isFinal" : @YES}];
    } else {
      [self emitOnSpeechError:@{
        @"code" : noSpeech ? @"no_match" : @"recognition_failed",
        @"message" : error.localizedDescription ?: @"Speech recognition failed"
      }];
    }
    [self finishSession];
  }
}

- (void)handleAudioLevel:(AVAudioPCMBuffer *)buffer
{
  float *const *channels = buffer.floatChannelData;
  AVAudioFrameCount frames = buffer.frameLength;
  if (channels == NULL || frames == 0) {
    return;
  }
  float *samples = channels[0];
  float sum = 0;
  for (AVAudioFrameCount i = 0; i < frames; i++) {
    sum += samples[i] * samples[i];
  }
  float rms = sqrtf(sum / frames);
  // Map roughly -50dB..0dB to 0..1
  float db = 20.f * log10f(MAX(rms, 1e-6f));
  double level = MIN(MAX((db + 50.f) / 50.f, 0.f), 1.f);

  dispatch_async(dispatch_get_main_queue(), ^{
    if (!self->_sessionActive) {
      return;
    }
    CFTimeInterval now = CACurrentMediaTime();
    if (now - self->_lastVolumeEmit < 0.08) {
      return;
    }
    self->_lastVolumeEmit = now;
    [self emitOnSpeechVolume:@{@"value" : @(level)}];
  });
}

#pragma mark - Teardown

- (void)finishSession
{
  [self teardownCancellingTask:NO];
  [self emitOnSpeechState:@{@"state" : @"ended"}];
}

- (void)stopAudio
{
  if (_audioEngine != nil) {
    if (_audioEngine.isRunning) {
      [_audioEngine stop];
    }
    [_audioEngine.inputNode removeTapOnBus:0];
  }
}

- (void)teardownCancellingTask:(BOOL)cancel
{
  _sessionActive = NO;
  [self stopAudio];
  [_request endAudio];
  if (cancel) {
    [_task cancel];
  }
  _task = nil;
  _request = nil;
  _audioEngine = nil;
  _recognizer = nil;

  if (_audioSessionActivated) {
    _audioSessionActivated = NO;
    [[AVAudioSession sharedInstance] setActive:NO
                                   withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                                         error:nil];
  }
}

@end
