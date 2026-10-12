import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeechToText } from './SpeechToText';
import type {
  SpeechError,
  SpeechRecognitionOptions,
  SpeechStatus,
} from './types';

export type UseSpeechToTextOptions = SpeechRecognitionOptions & {
  /** Stop after this many ms without new words once the user has started speaking. Default 2000. */
  silenceTimeout?: number;
  /** Stop after this many ms if the user never starts speaking. Default 6000. */
  initialSilenceTimeout?: number;
  /** Hard cap on a session's length in ms. 0 disables it. Default 60000. */
  maxDuration?: number;
  /** Called with the live (partial) transcript while the user speaks. */
  onPartialResult?: (text: string) => void;
  /** Called once with the final, non-empty transcript. */
  onResult?: (text: string) => void;
  onError?: (error: SpeechError) => void;
  /** Always called when a session ends, with the final transcript ('' if nothing was heard). */
  onEnd?: (text: string, error?: SpeechError) => void;
};

export type UseSpeechToTextResult = {
  status: SpeechStatus;
  isListening: boolean;
  /** Live transcript of the current/last session. */
  transcript: string;
  /** Microphone level 0..1 while listening. */
  volume: number;
  error: SpeechError | null;
  start: () => Promise<void>;
  /** Stop listening now and deliver whatever was recognised. */
  stop: () => void;
  /** Abort without delivering a result. */
  cancel: () => void;
};

const DEFAULT_SILENCE_TIMEOUT = 2000;
const DEFAULT_INITIAL_SILENCE_TIMEOUT = 6000;
const DEFAULT_MAX_DURATION = 60000;
// How long to wait for the recognizer's final result after we ask it to stop.
const FINAL_RESULT_GRACE = 1500;
const NO_SPEECH_CODES = ['no_match', 'speech_timeout'];

// The platform recognizer is a singleton, so only one hook instance may own it at a time.
let activeSession: number | null = null;
let sessionCounter = 0;

function toSpeechError(e: unknown, fallbackCode: string): SpeechError {
  const err = e as { code?: string; message?: string } | undefined;
  return {
    code: err?.code ?? fallbackCode,
    message: err?.message ?? String(e),
  };
}

export function useSpeechToText(
  options: UseSpeechToTextOptions = {}
): UseSpeechToTextResult {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<SpeechError | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sessionRef = useRef<number | null>(null);
  const transcriptRef = useRef('');
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    for (const t of [silenceTimer, maxTimer, graceTimer]) {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    }
  }, []);

  const isOwner = useCallback(
    () => sessionRef.current !== null && sessionRef.current === activeSession,
    []
  );

  const finish = useCallback(
    (text: string, err?: SpeechError) => {
      if (sessionRef.current === null) return;
      if (activeSession === sessionRef.current) activeSession = null;
      sessionRef.current = null;
      clearTimers();
      setVolume(0);

      const finalText = text.trim();
      const opts = optionsRef.current;
      if (err) {
        setError(err);
        setStatus('error');
        opts.onError?.(err);
      } else {
        setStatus('idle');
      }
      if (finalText) opts.onResult?.(finalText);
      opts.onEnd?.(finalText, err);
    },
    [clearTimers]
  );

  const stop = useCallback(() => {
    if (!isOwner() || graceTimer.current) return;
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (maxTimer.current) clearTimeout(maxTimer.current);
    silenceTimer.current = null;
    maxTimer.current = null;
    setStatus('processing');
    SpeechToText.stop().catch(() => {});
    // If the recognizer never sends a final result, fall back to the last partial.
    graceTimer.current = setTimeout(() => {
      graceTimer.current = null;
      SpeechToText.cancel().catch(() => {});
      finish(transcriptRef.current);
    }, FINAL_RESULT_GRACE);
  }, [finish, isOwner]);

  const armSilenceTimer = useCallback(
    (ms: number) => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(stop, ms);
    },
    [stop]
  );

  const cancel = useCallback(() => {
    if (sessionRef.current === null) return;
    const owned = isOwner();
    if (activeSession === sessionRef.current) activeSession = null;
    sessionRef.current = null;
    clearTimers();
    setVolume(0);
    setStatus('idle');
    if (owned) SpeechToText.cancel().catch(() => {});
  }, [clearTimers, isOwner]);

  const start = useCallback(async () => {
    // Restart cleanly if this hook (or another one) is mid-session.
    if (sessionRef.current !== null) cancel();
    if (activeSession !== null) SpeechToText.cancel().catch(() => {});

    const session = ++sessionCounter;
    sessionRef.current = session;
    activeSession = session;
    transcriptRef.current = '';
    setTranscript('');
    setError(null);
    setStatus('starting');

    const opts = optionsRef.current;
    try {
      let granted = await SpeechToText.hasPermissions();
      if (!granted) granted = await SpeechToText.requestPermissions();
      if (sessionRef.current !== session) return;
      if (!granted) {
        finish('', {
          code: 'permission_denied',
          message: 'Microphone permission was denied',
        });
        return;
      }

      await SpeechToText.start({
        locale: opts.locale,
        onDevice: opts.onDevice,
        silenceTimeout: opts.silenceTimeout ?? DEFAULT_SILENCE_TIMEOUT,
      });
      if (sessionRef.current !== session) return;

      setStatus('listening');
      armSilenceTimer(
        opts.initialSilenceTimeout ?? DEFAULT_INITIAL_SILENCE_TIMEOUT
      );
      const max = opts.maxDuration ?? DEFAULT_MAX_DURATION;
      if (max > 0) maxTimer.current = setTimeout(stop, max);
    } catch (e) {
      if (sessionRef.current === session) {
        finish('', toSpeechError(e, 'start_failed'));
      }
    }
  }, [armSilenceTimer, cancel, finish, stop]);

  useEffect(() => {
    let subs: { remove: () => void }[];
    try {
      subs = [
        SpeechToText.onResult(({ value, isFinal }) => {
          if (!isOwner()) return;
          transcriptRef.current = value;
          setTranscript(value);
          if (isFinal) {
            finish(value);
            return;
          }
          optionsRef.current.onPartialResult?.(value);
          // Still hearing words: push the silence deadline back (unless already stopping).
          if (!graceTimer.current) {
            armSilenceTimer(
              optionsRef.current.silenceTimeout ?? DEFAULT_SILENCE_TIMEOUT
            );
          }
        }),
        SpeechToText.onVolumeChange((v) => {
          if (isOwner()) setVolume(v);
        }),
        SpeechToText.onError((e) => {
          if (!isOwner()) return;
          const text = transcriptRef.current;
          if (text.trim() || NO_SPEECH_CODES.includes(e.code)) {
            finish(text);
          } else {
            finish('', e);
          }
        }),
        SpeechToText.onEnd(() => {
          if (isOwner()) finish(transcriptRef.current);
        }),
      ];
    } catch {
      // Native module not linked; start() will surface the error.
      subs = [];
    }
    return () => subs.forEach((s) => s.remove());
  }, [armSilenceTimer, finish, isOwner]);

  // Release the recognizer if the component unmounts mid-session.
  useEffect(() => cancel, [cancel]);

  return {
    status,
    isListening: status === 'listening',
    transcript,
    volume,
    error,
    start,
    stop,
    cancel,
  };
}
