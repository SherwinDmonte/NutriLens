import { useEffect, useState } from 'react';

const CLOCK_BOUNDARY_HOURS = Object.freeze([12, 18, 24]);

export function millisecondsUntilNextClockBoundary(now) {
  const nextBoundaryHour = CLOCK_BOUNDARY_HOURS.find((hour) => now.getHours() < hour) ?? 24;
  const nextBoundary = new Date(now);
  nextBoundary.setHours(nextBoundaryHour, 0, 0, 0);
  return Math.max(1_000, nextBoundary.getTime() - now.getTime() + 50);
}

export function useCurrentMoment() {
  const [currentMoment, setCurrentMoment] = useState(() => new Date());

  useEffect(() => {
    let timerId;

    function scheduleNextBoundary(now) {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        const nextMoment = new Date();
        setCurrentMoment(nextMoment);
        scheduleNextBoundary(nextMoment);
      }, millisecondsUntilNextClockBoundary(now));
    }

    function refreshCurrentMoment() {
      const nextMoment = new Date();
      setCurrentMoment(nextMoment);
      scheduleNextBoundary(nextMoment);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') refreshCurrentMoment();
    }

    scheduleNextBoundary(new Date());
    window.addEventListener('focus', refreshCurrentMoment);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('focus', refreshCurrentMoment);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return currentMoment;
}
