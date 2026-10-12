import { SpeechToText } from '../SpeechToText';

// Simulates installing the package without rebuilding the app / running in Expo Go.
jest.mock('../NativeVoiceToText', () => ({ __esModule: true, default: null }));

const LINKING_ERROR = /doesn't seem to be linked/;

describe('SpeechToText without the native module linked', () => {
  it('isAvailable resolves false instead of throwing', async () => {
    await expect(SpeechToText.isAvailable()).resolves.toBe(false);
  });

  it('every other call throws a helpful linking error', () => {
    expect(() => SpeechToText.hasPermissions()).toThrow(LINKING_ERROR);
    expect(() => SpeechToText.start()).toThrow(LINKING_ERROR);
    expect(() => SpeechToText.stop()).toThrow(LINKING_ERROR);
    expect(() => SpeechToText.cancel()).toThrow(LINKING_ERROR);
    expect(() => SpeechToText.onResult(jest.fn())).toThrow(LINKING_ERROR);
    expect(() => SpeechToText.onEnd(jest.fn())).toThrow(LINKING_ERROR);
  });
});
