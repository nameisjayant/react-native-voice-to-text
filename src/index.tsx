export { SpeechToText, type StartOptions } from './SpeechToText';
export {
  useSpeechToText,
  type UseSpeechToTextOptions,
  type UseSpeechToTextResult,
} from './useSpeechToText';
export type {
  SpeechError,
  SpeechErrorCode,
  SpeechRecognitionOptions,
  SpeechResult,
  SpeechStatus,
} from './types';

export {
  VoiceSearchDialog,
  defaultVoiceSearchTexts,
  type VoiceSearchDialogProps,
  type VoiceSearchDialogRenderProps,
  type VoiceSearchTexts,
} from './components/VoiceSearchDialog';
export {
  VoiceSearchBar,
  type VoiceSearchBarProps,
} from './components/VoiceSearchBar';
export { MicButton, type MicButtonProps } from './components/MicButton';
export {
  MicIcon,
  SearchIcon,
  type MicIconProps,
  type SearchIconProps,
} from './components/MicIcon';
export {
  defaultVoiceSearchTheme,
  lightVoiceSearchTheme,
  type VoiceSearchTheme,
} from './components/theme';
