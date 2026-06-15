import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTimerResult {
  secondsLeft: number;
  isRunning: boolean;
  isDone: boolean;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useTimer(onComplete?: () => void): UseTimerResult {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setIsDone(true);
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  const start = useCallback((seconds: number) => {
    setSecondsLeft(seconds);
    setIsRunning(true);
    setIsDone(false);
  }, []);

  const pause = useCallback(() => setIsRunning(false), []);

  const resume = useCallback(() => {
    setSecondsLeft((s) => {
      if (s > 0) setIsRunning(true);
      return s;
    });
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setIsDone(false);
    setSecondsLeft(0);
  }, []);

  return { secondsLeft, isRunning, isDone, start, pause, resume, reset };
}
