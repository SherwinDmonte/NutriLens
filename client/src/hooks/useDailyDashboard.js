import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { foodLogApi } from '../services/foodLogApi.js';
import {
  isCurrentDashboardSnapshot,
  shouldRefreshDashboardDate,
} from '../utils/dashboardSnapshot.js';

const emptySnapshot = Object.freeze({
  userId: null,
  date: null,
  requestToken: -1,
  status: 'loading',
  foodLogs: [],
  summary: null,
  error: null,
});

export function useDailyDashboard({ userId, selectedDate, onUnauthorized }) {
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [requestToken, setRequestToken] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (!userId) return undefined;

    const currentVersion = ++requestVersion.current;
    const controller = new AbortController();

    foodLogApi
      .getDailyDashboard(selectedDate, { signal: controller.signal })
      .then(({ foodLogs, summary }) => {
        if (currentVersion !== requestVersion.current || controller.signal.aborted) return;
        setSnapshot({
          userId,
          date: selectedDate,
          requestToken,
          status: 'success',
          foodLogs,
          summary,
          error: null,
        });
      })
      .catch((error) => {
        if (currentVersion !== requestVersion.current || controller.signal.aborted) return;
        if (error.status === 401) void onUnauthorized?.();
        setSnapshot({
          userId,
          date: selectedDate,
          requestToken,
          status: 'error',
          foodLogs: [],
          summary: null,
          error,
        });
      });

    return () => {
      controller.abort();
    };
  }, [onUnauthorized, requestToken, selectedDate, userId]);

  const retry = useCallback(() => {
    setRequestToken((current) => current + 1);
  }, []);

  const refreshDate = useCallback(
    (affectedDate) => {
      if (!shouldRefreshDashboardDate(affectedDate, selectedDate)) return false;
      setRequestToken((current) => current + 1);
      return true;
    },
    [selectedDate],
  );

  const clear = useCallback(() => {
    requestVersion.current += 1;
    setSnapshot(emptySnapshot);
  }, []);

  return useMemo(() => {
    const matchesCurrentRequest = isCurrentDashboardSnapshot(snapshot, {
      userId,
      selectedDate,
      requestToken,
    });

    if (!matchesCurrentRequest) {
      return {
        status: 'loading',
        isLoading: true,
        foodLogs: [],
        summary: null,
        error: null,
        retry,
        refreshDate,
        clear,
      };
    }

    return {
      ...snapshot,
      isLoading: snapshot.status === 'loading',
      retry,
      refreshDate,
      clear,
    };
  }, [clear, refreshDate, requestToken, retry, selectedDate, snapshot, userId]);
}
