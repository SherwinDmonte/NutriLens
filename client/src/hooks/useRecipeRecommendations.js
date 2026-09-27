import { useCallback, useEffect, useRef, useState } from 'react';

import { recipeApi } from '../services/recipeApi.js';
import { describeRecipeRequestError } from '../utils/recipeRecommendationForm.js';

const initialSnapshot = Object.freeze({
  status: 'idle',
  data: null,
  error: null,
  errorPresentation: null,
  lastRequest: null,
});

export function useRecipeRecommendations({ onUnauthorized, recommend = recipeApi.recommend } = {}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const requestVersion = useRef(0);
  const activeController = useRef(null);

  const submit = useCallback(
    async (request) => {
      const currentVersion = ++requestVersion.current;
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      setSnapshot({
        status: 'loading',
        data: null,
        error: null,
        errorPresentation: null,
        lastRequest: request,
      });

      try {
        const response = await recommend(request, { signal: controller.signal });
        if (controller.signal.aborted || currentVersion !== requestVersion.current) return null;

        const data = response.data;
        const status = data.status === 'no_match' ? 'no-match' : 'success';
        setSnapshot({
          status,
          data,
          error: null,
          errorPresentation: null,
          lastRequest: request,
        });
        return { status, data };
      } catch (error) {
        if (
          controller.signal.aborted ||
          currentVersion !== requestVersion.current ||
          error?.name === 'AbortError'
        ) {
          return null;
        }

        const errorPresentation = describeRecipeRequestError(error, {
          online: typeof navigator === 'undefined' ? true : navigator.onLine,
        });
        setSnapshot({
          status: 'error',
          data: null,
          error,
          errorPresentation,
          lastRequest: request,
        });
        if (errorPresentation.kind === 'unauthorized') void onUnauthorized?.();
        return { status: 'error', error, errorPresentation };
      } finally {
        if (currentVersion === requestVersion.current) activeController.current = null;
      }
    },
    [onUnauthorized, recommend],
  );

  const cancel = useCallback(() => {
    requestVersion.current += 1;
    activeController.current?.abort();
    activeController.current = null;
    setSnapshot(initialSnapshot);
  }, []);

  const retry = useCallback(() => {
    if (!snapshot.lastRequest) return Promise.resolve(null);
    return submit(snapshot.lastRequest);
  }, [snapshot.lastRequest, submit]);

  useEffect(
    () => () => {
      requestVersion.current += 1;
      activeController.current?.abort();
    },
    [],
  );

  return {
    ...snapshot,
    isLoading: snapshot.status === 'loading',
    submit,
    retry,
    cancel,
    reset: cancel,
  };
}
