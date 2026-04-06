import { useState, useEffect, useCallback } from 'react';

export function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  const toggleTimer = useCallback(() => setIsActive((prev) => !prev), []);
  const resetTimer = useCallback(() => {
    setSeconds(0);
    setIsActive(false);
  }, []);

  return { seconds, isActive, toggleTimer, resetTimer, setSeconds, setIsActive };
}
