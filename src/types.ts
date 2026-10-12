export type SpeechStatus =
  'idle' | 'starting' | 'listening' | 'processing' | 'error';

export type SpeechErrorCode =
  | 'permission_denied'
  | 'unavailable'
  | 'start_failed'
  | 'no_match'
  | 'speech_timeout'
  | 'audio'
  | 'client'
  | 'network'
  | 'network_timeout'
  | 'busy'
  | 'server'
  | 'recognition_failed'
  | 'unknown'
  | (string & {});

export type SpeechError = {
  code: SpeechErrorCode;
  message: string;
};

export type SpeechRecognitionOptions = {
  /** BCP-47 locale, e.g. 'en-US', 'hi-IN'. Defaults to the device language. */
  locale?: string;
  /** Prefer on-device recognition when the platform supports it. */
  onDevice?: boolean;
};

export type SpeechResult = {
  value: string;
  isFinal: boolean;
};
