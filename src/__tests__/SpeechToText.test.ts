import { PermissionsAndroid, Platform } from 'react-native';
import { SpeechToText } from '../SpeechToText';

jest.mock('../NativeVoiceToText');

const {
  default: native,
  emitError,
  emitResult,
  emitState,
  emitVolume,
  resetNativeMock,
} = jest.requireMock<typeof import('../__mocks__/NativeVoiceToText')>(
  '../NativeVoiceToText'
);

beforeEach(() => {
  resetNativeMock();
  jest.restoreAllMocks();
});

describe('SpeechToText.isAvailable', () => {
  it('returns the native answer', async () => {
    native.isAvailable.mockResolvedValue(false);
    await expect(SpeechToText.isAvailable()).resolves.toBe(false);

    native.isAvailable.mockResolvedValue(true);
    await expect(SpeechToText.isAvailable()).resolves.toBe(true);
  });

  it('returns false instead of throwing when the native call fails', async () => {
    native.isAvailable.mockRejectedValue(new Error('boom'));
    await expect(SpeechToText.isAvailable()).resolves.toBe(false);
  });
});

describe('SpeechToText permissions', () => {
  it('hasPermissions delegates to native', async () => {
    native.hasPermissions.mockResolvedValue(false);
    await expect(SpeechToText.hasPermissions()).resolves.toBe(false);
    expect(native.hasPermissions).toHaveBeenCalledTimes(1);
  });

  it('requestPermissions uses the native module on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const androidRequest = jest.spyOn(PermissionsAndroid, 'request');
    native.requestPermissions.mockResolvedValue(true);

    await expect(SpeechToText.requestPermissions()).resolves.toBe(true);
    expect(native.requestPermissions).toHaveBeenCalledTimes(1);
    expect(androidRequest).not.toHaveBeenCalled();
  });

  it('requestPermissions asks for RECORD_AUDIO on Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const request = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    await expect(SpeechToText.requestPermissions()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    expect(native.requestPermissions).not.toHaveBeenCalled();
  });

  it.each([
    PermissionsAndroid.RESULTS.DENIED,
    PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  ])('requestPermissions resolves false on Android when %s', async (res) => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(res);

    await expect(SpeechToText.requestPermissions()).resolves.toBe(false);
  });
});

describe('SpeechToText session control', () => {
  it('start forwards options to native', async () => {
    await SpeechToText.start({ locale: 'hi-IN', onDevice: true });
    expect(native.startListening).toHaveBeenCalledWith({
      locale: 'hi-IN',
      onDevice: true,
    });
  });

  it('start defaults to empty options', async () => {
    await SpeechToText.start();
    expect(native.startListening).toHaveBeenCalledWith({});
  });

  it('start propagates native rejections', async () => {
    native.startListening.mockRejectedValue(new Error('busy'));
    await expect(SpeechToText.start()).rejects.toThrow('busy');
  });

  it('stop and cancel delegate to native', async () => {
    await SpeechToText.stop();
    await SpeechToText.cancel();
    expect(native.stopListening).toHaveBeenCalledTimes(1);
    expect(native.cancelListening).toHaveBeenCalledTimes(1);
  });
});

describe('SpeechToText events', () => {
  it('onResult forwards result events', () => {
    const listener = jest.fn();
    SpeechToText.onResult(listener);

    emitResult('hello', false);
    emitResult('hello world', true);

    expect(listener).toHaveBeenNthCalledWith(1, {
      value: 'hello',
      isFinal: false,
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      value: 'hello world',
      isFinal: true,
    });
  });

  it('onError forwards error events', () => {
    const listener = jest.fn();
    SpeechToText.onError(listener);

    emitError('network', 'Network error');

    expect(listener).toHaveBeenCalledWith({
      code: 'network',
      message: 'Network error',
    });
  });

  it('onVolumeChange unwraps the level into a number', () => {
    const listener = jest.fn();
    SpeechToText.onVolumeChange(listener);

    emitVolume(0.42);

    expect(listener).toHaveBeenCalledWith(0.42);
  });

  it('onStart fires only for the "started" state', () => {
    const listener = jest.fn();
    SpeechToText.onStart(listener);

    emitState('ended');
    expect(listener).not.toHaveBeenCalled();

    emitState('started');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('onEnd fires only for the "ended" state', () => {
    const listener = jest.fn();
    SpeechToText.onEnd(listener);

    emitState('started');
    expect(listener).not.toHaveBeenCalled();

    emitState('ended');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('removing a subscription stops delivery', () => {
    const listener = jest.fn();
    const sub = SpeechToText.onResult(listener);

    sub.remove();
    emitResult('ignored');

    expect(listener).not.toHaveBeenCalled();
  });
});
