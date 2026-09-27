import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { millisecondsUntilNextClockBoundary, useCurrentMoment } from './useCurrentMoment.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('useCurrentMoment', () => {
  it('targets the next greeting or calendar boundary without minute-by-minute rendering', () => {
    const beforeNoon = new Date(2026, 7, 27, 11, 59, 59);
    const afterEvening = new Date(2026, 7, 27, 18, 0, 0);

    expect(millisecondsUntilNextClockBoundary(beforeNoon)).toBe(1_050);
    expect(millisecondsUntilNextClockBoundary(afterEvening)).toBe(6 * 60 * 60 * 1_000 + 50);
  });

  it('refreshes automatically when a live clock boundary is crossed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 27, 11, 59, 59));
    const { result } = renderHook(() => useCurrentMoment());

    expect(result.current.getHours()).toBe(11);
    act(() => {
      vi.advanceTimersByTime(1_050);
    });
    expect(result.current.getHours()).toBe(12);
  });
});
