import {
  TurboModuleRegistry,
  type CodegenTypes,
  type TurboModule,
} from 'react-native';

export type NativeSpeechResultEvent = {
  value: string;
  isFinal: boolean;
};

export type NativeSpeechErrorEvent = {
  code: string;
  message: string;
};

export type NativeSpeechVolumeEvent = {
  /** Normalised input level, 0..1 */
  value: number;
};

export type NativeSpeechStateEvent = {
  /** 'started' once audio capture begins, 'ended' once the session is fully torn down */
  state: string;
};

export interface Spec extends TurboModule {
  isAvailable(): Promise<boolean>;
  hasPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  /**
   * options: { locale?: string, onDevice?: boolean, silenceTimeout?: number }
   */
  startListening(options: CodegenTypes.UnsafeObject): Promise<void>;
  /** Stop capturing audio and deliver a final result. */
  stopListening(): Promise<void>;
  /** Abort immediately without delivering a result. */
  cancelListening(): Promise<void>;

  readonly onSpeechState: CodegenTypes.EventEmitter<NativeSpeechStateEvent>;
  readonly onSpeechResult: CodegenTypes.EventEmitter<NativeSpeechResultEvent>;
  readonly onSpeechError: CodegenTypes.EventEmitter<NativeSpeechErrorEvent>;
  readonly onSpeechVolume: CodegenTypes.EventEmitter<NativeSpeechVolumeEvent>;
}

export default TurboModuleRegistry.get<Spec>('VoiceToText');
