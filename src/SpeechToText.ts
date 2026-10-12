import { PermissionsAndroid, Platform } from 'react-native';
import type { EventSubscription } from 'react-native';
import NativeVoiceToText from './NativeVoiceToText';
import type { Spec } from './NativeVoiceToText';
import type {
  SpeechError,
  SpeechRecognitionOptions,
  SpeechResult,
} from './types';

const LINKING_ERROR =
  "The package 'react-native-voice-to-text' doesn't seem to be linked. Make sure: \n\n" +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

function native(): Spec {
  if (!NativeVoiceToText) {
    throw new Error(LINKING_ERROR);
  }
  return NativeVoiceToText;
}

export type StartOptions = SpeechRecognitionOptions & {
  /** Passed to the platform recognizer as an end-of-speech hint (Android). */
  silenceTimeout?: number;
};

/**
 * Low-level, imperative speech-to-text API. Most apps should use
 * `useSpeechToText` or `VoiceSearchDialog` instead, which add silence
 * detection and session handling on top of this.
 */
export const SpeechToText = {
  /** Whether a speech recognition service exists on this device. */
  async isAvailable(): Promise<boolean> {
    if (!NativeVoiceToText) return false;
    try {
      return await NativeVoiceToText.isAvailable();
    } catch {
      return false;
    }
  },

  /** Whether microphone (and on iOS, speech recognition) permission is granted. */
  hasPermissions(): Promise<boolean> {
    return native().hasPermissions();
  },

  /** Prompts for the permissions needed to listen. Resolves to true when granted. */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return native().requestPermissions();
  },

  start(options: StartOptions = {}): Promise<void> {
    return native().startListening(options);
  },

  /** Stops capturing audio; a final result event follows. */
  stop(): Promise<void> {
    return native().stopListening();
  },

  /** Aborts the session without delivering a result. */
  cancel(): Promise<void> {
    return native().cancelListening();
  },

  onResult(listener: (result: SpeechResult) => void): EventSubscription {
    return native().onSpeechResult(listener);
  },

  onError(listener: (error: SpeechError) => void): EventSubscription {
    return native().onSpeechError(listener);
  },

  /** Normalised microphone level in the range 0..1, roughly every 80ms. */
  onVolumeChange(listener: (volume: number) => void): EventSubscription {
    return native().onSpeechVolume((e) => listener(e.value));
  },

  onStart(listener: () => void): EventSubscription {
    return native().onSpeechState((e) => {
      if (e.state === 'started') listener();
    });
  },

  /** Fires once the native session has fully ended (after the final result or an error). */
  onEnd(listener: () => void): EventSubscription {
    return native().onSpeechState((e) => {
      if (e.state === 'ended') listener();
    });
  },
};
