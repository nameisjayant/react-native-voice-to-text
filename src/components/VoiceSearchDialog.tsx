import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  useSpeechToText,
  type UseSpeechToTextOptions,
} from '../useSpeechToText';
import type { SpeechError, SpeechStatus } from '../types';
import { MicIcon } from './MicIcon';
import { defaultVoiceSearchTheme, type VoiceSearchTheme } from './theme';

export type VoiceSearchTexts = {
  starting: string;
  listening: string;
  speakNow: string;
  processing: string;
  noSpeech: string;
  tapToRetry: string;
  error: string;
  permissionDenied: string;
  cancel: string;
};

export const defaultVoiceSearchTexts: VoiceSearchTexts = {
  starting: 'Getting ready…',
  listening: 'Listening…',
  speakNow: 'Speak now',
  processing: 'Got it',
  noSpeech: "Didn't catch that",
  tapToRetry: 'Tap the mic to try again',
  error: 'Something went wrong',
  permissionDenied: 'Microphone permission is required',
  cancel: 'Cancel',
};

export type VoiceSearchDialogRenderProps = {
  status: SpeechStatus;
  transcript: string;
  /** Mic level 0..1 */
  volume: number;
  error: SpeechError | null;
  /** True when the last session ended without hearing anything. */
  noSpeech: boolean;
  theme: VoiceSearchTheme;
  texts: VoiceSearchTexts;
  /** Finish now and deliver the transcript. */
  stop: () => void;
  /** Start a new listening session. */
  retry: () => void;
  /** Close without a result. */
  cancel: () => void;
};

export type VoiceSearchDialogProps = Omit<
  UseSpeechToTextOptions,
  'onResult' | 'onEnd'
> & {
  visible: boolean;
  /** Called with the recognised text (never empty) just before the dialog closes. */
  onResult: (text: string) => void;
  /** Called whenever the dialog wants to close: after a result, on cancel, or after silence with no speech. */
  onClose: () => void;
  /** Close automatically when the user never speaks. If false, a retry state is shown instead. Default true. */
  closeOnNoSpeech?: boolean;
  /** Tapping outside the card cancels. Default true. */
  dismissOnBackdropPress?: boolean;
  showTranscript?: boolean;
  showCancelButton?: boolean;
  position?: 'center' | 'bottom';
  animationType?: 'fade' | 'slide' | 'none';

  theme?: Partial<VoiceSearchTheme>;
  texts?: Partial<VoiceSearchTexts>;

  backdropStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
  micContainerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  transcriptStyle?: StyleProp<TextStyle>;
  cancelButtonStyle?: StyleProp<ViewStyle>;
  cancelTextStyle?: StyleProp<TextStyle>;

  /** Replace the mic glyph inside the circle. */
  renderMicIcon?: (props: {
    size: number;
    color: string;
    status: SpeechStatus;
  }) => ReactNode;
  /** Replace everything inside the card with your own UI. */
  renderContent?: (props: VoiceSearchDialogRenderProps) => ReactNode;
};

export function VoiceSearchDialog({
  visible,
  onResult,
  onClose,
  closeOnNoSpeech = true,
  dismissOnBackdropPress = true,
  showTranscript = true,
  showCancelButton = true,
  position = 'center',
  animationType = 'fade',
  theme: themeOverride,
  texts: textsOverride,
  backdropStyle,
  cardStyle,
  micContainerStyle,
  titleStyle,
  subtitleStyle,
  transcriptStyle,
  cancelButtonStyle,
  cancelTextStyle,
  renderMicIcon,
  renderContent,
  ...speechOptions
}: VoiceSearchDialogProps) {
  const theme = { ...defaultVoiceSearchTheme, ...themeOverride };
  const texts = { ...defaultVoiceSearchTexts, ...textsOverride };
  const [noSpeech, setNoSpeech] = useState(false);

  const callbacks = useRef({ onResult, onClose, closeOnNoSpeech });
  callbacks.current = { onResult, onClose, closeOnNoSpeech };

  const speech = useSpeechToText({
    ...speechOptions,
    onEnd: (text, err) => {
      if (err) return; // stay open on the error state so the user can retry
      if (text) {
        callbacks.current.onResult(text);
        callbacks.current.onClose();
      } else if (callbacks.current.closeOnNoSpeech) {
        callbacks.current.onClose();
      } else {
        setNoSpeech(true);
      }
    },
  });
  const { status, transcript, volume, error } = speech;

  const speechRef = useRef(speech);
  speechRef.current = speech;

  useEffect(() => {
    if (visible) {
      setNoSpeech(false);
      speechRef.current.start();
    } else {
      speechRef.current.cancel();
    }
  }, [visible]);

  const retry = () => {
    setNoSpeech(false);
    speech.start();
  };
  const cancel = () => {
    speech.cancel();
    onClose();
  };
  const onMicPress = () => {
    if (status === 'listening') speech.stop();
    else if (status === 'idle' || status === 'error') retry();
  };

  const listening = status === 'listening';
  const inactive = status === 'error' || (status === 'idle' && noSpeech);

  const level = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(level, {
      toValue: listening ? volume : 0,
      speed: 40,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [level, listening, volume]);

  useEffect(() => {
    if (!listening) {
      breath.stopAnimation();
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(breath, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [breath, listening]);

  let title: string;
  let subtitle: string | null = null;
  if (status === 'error') {
    title =
      error?.code === 'permission_denied'
        ? texts.permissionDenied
        : texts.error;
    subtitle = texts.tapToRetry;
  } else if (noSpeech && status === 'idle') {
    title = texts.noSpeech;
    subtitle = texts.tapToRetry;
  } else if (status === 'processing') {
    title = texts.processing;
  } else if (status === 'starting') {
    title = texts.starting;
  } else {
    title = texts.listening;
    if (!transcript) subtitle = texts.speakNow;
  }

  const micSize = theme.micSize;
  const fontFamily = theme.fontFamily ? { fontFamily: theme.fontFamily } : null;

  const renderProps: VoiceSearchDialogRenderProps = {
    status,
    transcript,
    volume,
    error,
    noSpeech,
    theme,
    texts,
    stop: speech.stop,
    retry,
    cancel,
  };

  const defaultContent = (
    <>
      <Pressable
        onPress={onMicPress}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop listening' : 'Start listening'}
        style={[
          styles.micArea,
          { width: micSize * 1.9, height: micSize * 1.9 },
          micContainerStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.ring,
            {
              width: micSize,
              height: micSize,
              borderRadius: micSize / 2,
              backgroundColor: theme.pulseColor,
              opacity: breath.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 0],
              }),
              transform: [
                {
                  scale: breath.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.8],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            {
              width: micSize,
              height: micSize,
              borderRadius: micSize / 2,
              backgroundColor: theme.pulseColor,
              transform: [
                {
                  scale: level.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.75],
                  }),
                },
              ],
            },
          ]}
        />
        <View
          style={[
            styles.micCircle,
            {
              width: micSize,
              height: micSize,
              borderRadius: micSize / 2,
              backgroundColor: inactive
                ? theme.inactiveColor
                : theme.primaryColor,
            },
          ]}
        >
          {renderMicIcon ? (
            renderMicIcon({
              size: micSize * 0.42,
              color: theme.micIconColor,
              status,
            })
          ) : (
            <MicIcon size={micSize * 0.42} color={theme.micIconColor} />
          )}
        </View>
      </Pressable>

      <Text
        style={[
          styles.title,
          { color: status === 'error' ? theme.errorColor : theme.titleColor },
          fontFamily,
          titleStyle,
        ]}
      >
        {title}
      </Text>

      {showTranscript && transcript && status !== 'error' ? (
        <Text
          style={[
            styles.transcript,
            { color: theme.transcriptColor },
            fontFamily,
            transcriptStyle,
          ]}
          numberOfLines={3}
        >
          “{transcript}”
        </Text>
      ) : null}

      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { color: theme.subtitleColor },
            fontFamily,
            subtitleStyle,
          ]}
        >
          {subtitle}
        </Text>
      ) : null}

      {showCancelButton ? (
        <Pressable
          onPress={cancel}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [
            styles.cancelButton,
            { opacity: pressed ? 0.6 : 1 },
            cancelButtonStyle,
          ]}
        >
          <Text
            style={[
              styles.cancelText,
              { color: theme.buttonTextColor },
              fontFamily,
              cancelTextStyle,
            ]}
          >
            {texts.cancel}
          </Text>
        </Pressable>
      ) : null}
    </>
  );

  const bottom = position === 'bottom';

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={animationType}
      onRequestClose={cancel}
    >
      <View
        style={[
          styles.backdrop,
          bottom ? styles.backdropBottom : styles.backdropCenter,
          { backgroundColor: theme.backdropColor },
          backdropStyle,
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdropPress ? cancel : undefined}
          accessible={false}
        />
        <View
          style={[
            styles.card,
            bottom ? styles.cardBottom : styles.cardCenter,
            {
              backgroundColor: theme.backgroundColor,
              borderRadius: theme.borderRadius,
            },
            bottom && styles.squareBottom,
            cardStyle,
          ]}
        >
          {renderContent ? renderContent(renderProps) : defaultContent}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  backdropCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdropBottom: { justifyContent: 'flex-end' },
  card: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  cardCenter: { width: '100%', maxWidth: 360 },
  cardBottom: { width: '100%', paddingBottom: 36 },
  squareBottom: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  micArea: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
  micCircle: { alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  transcript: {
    fontSize: 17,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 8 },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: { fontSize: 15, fontWeight: '500' },
});
