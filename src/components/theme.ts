export type VoiceSearchTheme = {
  /** Dim layer behind the dialog. */
  backdropColor: string;
  /** Dialog surface. */
  backgroundColor: string;
  /** Mic circle while listening. */
  primaryColor: string;
  /** Mic circle when idle / after an error. */
  inactiveColor: string;
  /** Pulsing ring around the mic. */
  pulseColor: string;
  micIconColor: string;
  titleColor: string;
  subtitleColor: string;
  transcriptColor: string;
  errorColor: string;
  buttonTextColor: string;
  borderRadius: number;
  /** Diameter of the mic circle. */
  micSize: number;
  fontFamily?: string;
};

export const defaultVoiceSearchTheme: VoiceSearchTheme = {
  backdropColor: 'rgba(0, 0, 0, 0.55)',
  backgroundColor: '#1F1F1F',
  primaryColor: '#E5483D',
  inactiveColor: '#5A5A5A',
  pulseColor: 'rgba(229, 72, 61, 0.28)',
  micIconColor: '#FFFFFF',
  titleColor: '#FFFFFF',
  subtitleColor: '#B4B4B4',
  transcriptColor: '#FFFFFF',
  errorColor: '#FF8A80',
  buttonTextColor: '#B4B4B4',
  borderRadius: 20,
  micSize: 76,
};

export const lightVoiceSearchTheme: VoiceSearchTheme = {
  ...defaultVoiceSearchTheme,
  backdropColor: 'rgba(0, 0, 0, 0.35)',
  backgroundColor: '#FFFFFF',
  primaryColor: '#1A73E8',
  inactiveColor: '#BDBDBD',
  pulseColor: 'rgba(26, 115, 232, 0.2)',
  titleColor: '#202124',
  subtitleColor: '#5F6368',
  transcriptColor: '#202124',
  errorColor: '#D93025',
  buttonTextColor: '#5F6368',
};
