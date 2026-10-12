import type {
  NativeSpeechErrorEvent,
  NativeSpeechResultEvent,
  NativeSpeechStateEvent,
  NativeSpeechVolumeEvent,
} from '../NativeVoiceToText';

/**
 * In-memory stand-in for the VoiceToText TurboModule. Tests drive the
 * "native" side by calling `emit*` and assert on the jest.fn methods.
 */
function createEmitter<T>() {
  const listeners = new Set<(event: T) => void>();
  const subscribe = jest.fn((listener: (event: T) => void) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  });
  return Object.assign(subscribe, {
    emit: (event: T) => [...listeners].forEach((l) => l(event)),
    listenerCount: () => listeners.size,
    reset: () => listeners.clear(),
  });
}

const mock = {
  isAvailable: jest.fn<Promise<boolean>, []>(),
  hasPermissions: jest.fn<Promise<boolean>, []>(),
  requestPermissions: jest.fn<Promise<boolean>, []>(),
  startListening: jest.fn<Promise<void>, [object]>(),
  stopListening: jest.fn<Promise<void>, []>(),
  cancelListening: jest.fn<Promise<void>, []>(),
  onSpeechState: createEmitter<NativeSpeechStateEvent>(),
  onSpeechResult: createEmitter<NativeSpeechResultEvent>(),
  onSpeechError: createEmitter<NativeSpeechErrorEvent>(),
  onSpeechVolume: createEmitter<NativeSpeechVolumeEvent>(),
};

export function resetNativeMock() {
  mock.isAvailable.mockReset().mockResolvedValue(true);
  mock.hasPermissions.mockReset().mockResolvedValue(true);
  mock.requestPermissions.mockReset().mockResolvedValue(true);
  mock.startListening.mockReset().mockResolvedValue(undefined);
  mock.stopListening.mockReset().mockResolvedValue(undefined);
  mock.cancelListening.mockReset().mockResolvedValue(undefined);
  for (const emitter of [
    mock.onSpeechState,
    mock.onSpeechResult,
    mock.onSpeechError,
    mock.onSpeechVolume,
  ]) {
    emitter.mockClear();
    emitter.reset();
  }
}

export const emitResult = (value: string, isFinal = false) =>
  mock.onSpeechResult.emit({ value, isFinal });
export const emitError = (code: string, message = code) =>
  mock.onSpeechError.emit({ code, message });
export const emitVolume = (value: number) =>
  mock.onSpeechVolume.emit({ value });
export const emitState = (state: 'started' | 'ended') =>
  mock.onSpeechState.emit({ state });

resetNativeMock();

export default mock;
