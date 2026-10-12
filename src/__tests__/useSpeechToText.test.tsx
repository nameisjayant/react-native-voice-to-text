import { act, renderHook } from '@testing-library/react-native';
import {
  useSpeechToText,
  type UseSpeechToTextOptions,
} from '../useSpeechToText';

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
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function setup(options: UseSpeechToTextOptions = {}) {
  const callbacks = {
    onPartialResult: jest.fn(),
    onResult: jest.fn(),
    onError: jest.fn(),
    onEnd: jest.fn(),
  };
  return renderHook(() => useSpeechToText({ ...callbacks, ...options })).then(
    (hook) => ({ ...hook, ...callbacks })
  );
}

async function startListening(options: UseSpeechToTextOptions = {}) {
  const hook = await setup(options);
  await act(() => hook.result.current.start());
  return hook;
}

const emit = (fn: () => void) => act(async () => fn());
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('initial state', () => {
  it('is idle with no transcript, volume or error', async () => {
    const { result } = await setup();
    expect(result.current).toMatchObject({
      status: 'idle',
      isListening: false,
      transcript: '',
      volume: 0,
      error: null,
    });
  });

  it('does not touch the recognizer until start is called', async () => {
    await setup();
    expect(native.startListening).not.toHaveBeenCalled();
    expect(native.hasPermissions).not.toHaveBeenCalled();
  });
});

describe('start', () => {
  it('starts listening with default options', async () => {
    const { result } = await startListening();

    expect(native.startListening).toHaveBeenCalledWith({
      locale: undefined,
      onDevice: undefined,
      silenceTimeout: 2000,
    });
    expect(result.current.status).toBe('listening');
    expect(result.current.isListening).toBe(true);
  });

  it('forwards locale, onDevice and silenceTimeout to native', async () => {
    await startListening({
      locale: 'hi-IN',
      onDevice: true,
      silenceTimeout: 1200,
    });

    expect(native.startListening).toHaveBeenCalledWith({
      locale: 'hi-IN',
      onDevice: true,
      silenceTimeout: 1200,
    });
  });

  it('is in the "starting" state while waiting for native', async () => {
    let resolveStart!: () => void;
    native.startListening.mockReturnValue(
      new Promise<void>((r) => (resolveStart = r))
    );
    const { result } = await setup();

    let startPromise!: Promise<void>;
    await act(async () => {
      startPromise = result.current.start();
    });
    expect(result.current.status).toBe('starting');

    await act(async () => {
      resolveStart();
      await startPromise;
    });
    expect(result.current.status).toBe('listening');
  });

  it('skips the permission prompt when already granted', async () => {
    await startListening();
    expect(native.requestPermissions).not.toHaveBeenCalled();
  });

  it('requests permission when missing and continues once granted', async () => {
    native.hasPermissions.mockResolvedValue(false);
    native.requestPermissions.mockResolvedValue(true);

    const { result } = await startListening();

    expect(native.requestPermissions).toHaveBeenCalledTimes(1);
    expect(native.startListening).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('listening');
  });

  it('ends with permission_denied when permission is refused', async () => {
    native.hasPermissions.mockResolvedValue(false);
    native.requestPermissions.mockResolvedValue(false);

    const { result, onError, onEnd, onResult } = await startListening();

    const expected = {
      code: 'permission_denied',
      message: 'Microphone permission was denied',
    };
    expect(native.startListening).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual(expected);
    expect(onError).toHaveBeenCalledWith(expected);
    expect(onEnd).toHaveBeenCalledWith('', expected);
    expect(onResult).not.toHaveBeenCalled();
  });

  it('reports start_failed when native start rejects with a plain error', async () => {
    native.startListening.mockRejectedValue(new Error('mic busy'));

    const { result, onError } = await startListening();

    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual({
      code: 'start_failed',
      message: 'mic busy',
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('keeps the native error code when one is provided', async () => {
    native.startListening.mockRejectedValue({
      code: 'unavailable',
      message: 'No recognizer',
    });

    const { result } = await startListening();

    expect(result.current.error).toEqual({
      code: 'unavailable',
      message: 'No recognizer',
    });
  });

  it('clears the previous transcript and error on a new session', async () => {
    native.startListening.mockRejectedValueOnce(new Error('first fails'));
    const { result } = await startListening();
    expect(result.current.error).not.toBeNull();

    await act(() => result.current.start());

    expect(result.current.error).toBeNull();
    expect(result.current.transcript).toBe('');
    expect(result.current.status).toBe('listening');
  });

  it('restarting mid-session cancels the running session first', async () => {
    const { result, onEnd } = await startListening();
    await emit(() => emitResult('first'));

    await act(() => result.current.start());

    expect(native.cancelListening).toHaveBeenCalled();
    expect(native.startListening).toHaveBeenCalledTimes(2);
    expect(result.current.transcript).toBe('');
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe('results', () => {
  it('updates the transcript and calls onPartialResult for partial results', async () => {
    const { result, onPartialResult, onResult } = await startListening();

    await emit(() => emitResult('hello'));
    await emit(() => emitResult('hello world'));

    expect(result.current.transcript).toBe('hello world');
    expect(onPartialResult).toHaveBeenNthCalledWith(1, 'hello');
    expect(onPartialResult).toHaveBeenNthCalledWith(2, 'hello world');
    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.status).toBe('listening');
  });

  it('finishes with the trimmed text on a final result', async () => {
    const { result, onResult, onEnd, onPartialResult } = await startListening();

    await emit(() => emitResult('  pizza near me  ', true));

    expect(onResult).toHaveBeenCalledWith('pizza near me');
    expect(onEnd).toHaveBeenCalledWith('pizza near me', undefined);
    expect(onPartialResult).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.isListening).toBe(false);
  });

  it('does not call onResult for an empty final result', async () => {
    const { onResult, onEnd } = await startListening();

    await emit(() => emitResult('   ', true));

    expect(onResult).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith('', undefined);
  });

  it('delivers the result only once even if native sends more events', async () => {
    const { onResult, onEnd } = await startListening();

    await emit(() => emitResult('done', true));
    await emit(() => emitResult('late', true));
    await emit(() => emitState('ended'));

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores native events when no session is running', async () => {
    const { result, onResult, onPartialResult } = await setup();

    await emit(() => emitResult('stray'));
    await emit(() => emitResult('stray', true));
    await emit(() => emitVolume(0.9));

    expect(result.current.transcript).toBe('');
    expect(result.current.volume).toBe(0);
    expect(onResult).not.toHaveBeenCalled();
    expect(onPartialResult).not.toHaveBeenCalled();
  });

  it('finishes with the last partial when native reports the session ended', async () => {
    const { result, onResult } = await startListening();

    await emit(() => emitResult('weather today'));
    await emit(() => emitState('ended'));

    expect(onResult).toHaveBeenCalledWith('weather today');
    expect(result.current.status).toBe('idle');
  });

  it('ignores the "started" state event', async () => {
    const { result, onEnd } = await startListening();

    await emit(() => emitState('started'));

    expect(result.current.status).toBe('listening');
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe('volume', () => {
  it('tracks the mic level while listening and resets on finish', async () => {
    const { result } = await startListening();

    await emit(() => emitVolume(0.7));
    expect(result.current.volume).toBe(0.7);

    await emit(() => emitResult('ok', true));
    expect(result.current.volume).toBe(0);
  });
});

describe('silence detection', () => {
  it('stops after the initial silence timeout if the user never speaks', async () => {
    const { result } = await startListening();

    await advance(5999);
    expect(native.stopListening).not.toHaveBeenCalled();

    await advance(1);
    expect(native.stopListening).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('processing');
  });

  it('respects a custom initialSilenceTimeout', async () => {
    await startListening({ initialSilenceTimeout: 1000 });

    await advance(1000);
    expect(native.stopListening).toHaveBeenCalledTimes(1);
  });

  it('stops after silenceTimeout once the user has spoken', async () => {
    await startListening();
    await emit(() => emitResult('hello'));

    await advance(1999);
    expect(native.stopListening).not.toHaveBeenCalled();

    await advance(1);
    expect(native.stopListening).toHaveBeenCalledTimes(1);
  });

  it('pushes the silence deadline back on every new partial result', async () => {
    await startListening({ silenceTimeout: 1000 });

    await emit(() => emitResult('one'));
    await advance(900);
    await emit(() => emitResult('one two'));
    await advance(900);
    await emit(() => emitResult('one two three'));
    await advance(900);
    expect(native.stopListening).not.toHaveBeenCalled();

    await advance(100);
    expect(native.stopListening).toHaveBeenCalledTimes(1);
  });

  it('delivers the final result that arrives after a silence stop', async () => {
    const { result, onResult } = await startListening();
    await emit(() => emitResult('coffee'));
    await advance(2000);
    expect(result.current.status).toBe('processing');

    await emit(() => emitResult('coffee shops', true));

    expect(onResult).toHaveBeenCalledWith('coffee shops');
    expect(result.current.status).toBe('idle');
  });

  it('falls back to the last partial if no final result arrives within the grace period', async () => {
    const { result, onResult, onEnd } = await startListening();
    await emit(() => emitResult('fallback text'));
    await advance(2000);

    await advance(1499);
    expect(onResult).not.toHaveBeenCalled();

    await advance(1);
    expect(native.cancelListening).toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith('fallback text');
    expect(onEnd).toHaveBeenCalledWith('fallback text', undefined);
    expect(result.current.status).toBe('idle');
  });

  it('ends with an empty transcript when nothing was heard', async () => {
    const { onResult, onEnd } = await startListening();

    await advance(6000 + 1500);

    expect(onResult).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith('', undefined);
  });

  it('does not re-arm the silence timer for partials while stopping', async () => {
    await startListening();
    await emit(() => emitResult('a'));
    await advance(2000);

    await emit(() => emitResult('a b'));
    await advance(2000);

    expect(native.stopListening).toHaveBeenCalledTimes(1);
  });
});

describe('maxDuration', () => {
  it('stops after 60s by default even while the user keeps talking', async () => {
    await startListening();

    for (let elapsed = 0; elapsed < 60000; elapsed += 1000) {
      await emit(() => emitResult(`word ${elapsed}`));
      await advance(1000);
    }

    expect(native.stopListening).toHaveBeenCalledTimes(1);
  });

  it('respects a custom maxDuration', async () => {
    await startListening({ maxDuration: 3000, silenceTimeout: 10000 });
    await emit(() => emitResult('talking'));

    await advance(3000);
    expect(native.stopListening).toHaveBeenCalledTimes(1);
  });

  it('can be disabled with 0', async () => {
    await startListening({ maxDuration: 0, silenceTimeout: 5000 });

    for (let i = 0; i < 30; i++) {
      await emit(() => emitResult(`word ${i}`));
      await advance(4000);
    }

    expect(native.stopListening).not.toHaveBeenCalled();
  });
});

describe('stop', () => {
  it('moves to processing and asks native to stop', async () => {
    const { result } = await startListening();

    await act(async () => result.current.stop());

    expect(result.current.status).toBe('processing');
    expect(native.stopListening).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when called twice', async () => {
    const { result } = await startListening();

    await act(async () => result.current.stop());
    await act(async () => result.current.stop());

    expect(native.stopListening).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when idle', async () => {
    const { result } = await setup();

    await act(async () => result.current.stop());

    expect(native.stopListening).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('swallows a native stop rejection', async () => {
    native.stopListening.mockRejectedValue(new Error('already stopped'));
    const { result, onEnd } = await startListening();

    await act(async () => result.current.stop());
    await advance(1500);

    expect(onEnd).toHaveBeenCalledWith('', undefined);
  });
});

describe('cancel', () => {
  it('aborts without delivering a result', async () => {
    const { result, onResult, onEnd } = await startListening();
    await emit(() => emitResult('half a sentence'));
    await emit(() => emitVolume(0.5));

    await act(async () => result.current.cancel());

    expect(native.cancelListening).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(result.current.volume).toBe(0);
    expect(onResult).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('clears pending timers', async () => {
    const { result } = await startListening();

    await act(async () => result.current.cancel());
    await advance(60000);

    expect(native.stopListening).not.toHaveBeenCalled();
  });

  it('ignores events that arrive after cancelling', async () => {
    const { result, onResult } = await startListening();
    await act(async () => result.current.cancel());

    await emit(() => emitResult('too late', true));

    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.transcript).toBe('');
  });

  it('is a no-op when idle', async () => {
    const { result } = await setup();

    await act(async () => result.current.cancel());

    expect(native.cancelListening).not.toHaveBeenCalled();
  });

  it('cancelling while waiting for permission prevents the session from starting', async () => {
    let grant!: (v: boolean) => void;
    native.hasPermissions.mockReturnValue(
      new Promise<boolean>((r) => (grant = r))
    );
    const { result, onEnd } = await setup();

    let startPromise!: Promise<void>;
    await act(async () => {
      startPromise = result.current.start();
    });
    await act(async () => result.current.cancel());
    await act(async () => {
      grant(true);
      await startPromise;
    });

    expect(native.startListening).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe('errors', () => {
  it('reports a recognizer error when nothing was heard', async () => {
    const { result, onError, onEnd } = await startListening();

    await emit(() => emitError('network', 'Network unavailable'));

    const expected = { code: 'network', message: 'Network unavailable' };
    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual(expected);
    expect(onError).toHaveBeenCalledWith(expected);
    expect(onEnd).toHaveBeenCalledWith('', expected);
  });

  it.each(['no_match', 'speech_timeout'])(
    'treats "%s" as silence rather than an error',
    async (code) => {
      const { result, onError, onEnd } = await startListening();

      await emit(() => emitError(code));

      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(onError).not.toHaveBeenCalled();
      expect(onEnd).toHaveBeenCalledWith('', undefined);
    }
  );

  it('keeps what was already heard when an error arrives mid-sentence', async () => {
    const { result, onResult, onError } = await startListening();
    await emit(() => emitResult('book a cab'));

    await emit(() => emitError('network'));

    expect(onResult).toHaveBeenCalledWith('book a cab');
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });
});

describe('lifecycle and ownership', () => {
  it('cancels the native session when unmounted mid-session', async () => {
    const { unmount, onEnd } = await startListening();

    await unmount();

    expect(native.cancelListening).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('removes its native listeners on unmount', async () => {
    const { unmount } = await setup();
    expect(native.onSpeechResult.listenerCount()).toBe(1);

    await unmount();

    expect(native.onSpeechResult.listenerCount()).toBe(0);
    expect(native.onSpeechError.listenerCount()).toBe(0);
    expect(native.onSpeechVolume.listenerCount()).toBe(0);
    expect(native.onSpeechState.listenerCount()).toBe(0);
  });

  it('only the hook that started most recently receives events', async () => {
    const first = await startListening();
    const second = await startListening();

    // Starting the second hook stopped the recognizer the first one was using.
    expect(native.cancelListening).toHaveBeenCalledTimes(1);

    await emit(() => emitResult('for the second hook', true));

    expect(second.onResult).toHaveBeenCalledWith('for the second hook');
    expect(first.onResult).not.toHaveBeenCalled();
    expect(first.result.current.transcript).toBe('');
  });

  it('a hook that lost ownership does not cancel the new owner', async () => {
    const first = await startListening();
    await startListening();
    native.cancelListening.mockClear();

    await act(async () => first.result.current.cancel());

    expect(native.cancelListening).not.toHaveBeenCalled();
  });

  it('uses the latest callbacks without restarting', async () => {
    const onResultA = jest.fn();
    const onResultB = jest.fn();
    const { result, rerender } = await renderHook(
      (props: { onResult: (t: string) => void }) => useSpeechToText(props),
      { initialProps: { onResult: onResultA } }
    );
    await act(() => result.current.start());

    await rerender({ onResult: onResultB });
    await emit(() => emitResult('latest', true));

    expect(onResultA).not.toHaveBeenCalled();
    expect(onResultB).toHaveBeenCalledWith('latest');
    expect(native.startListening).toHaveBeenCalledTimes(1);
  });
});
