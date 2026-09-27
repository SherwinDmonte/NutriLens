import assert from 'node:assert/strict';
import { useRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, vi } from 'vitest';

import { useRecipeRecommendations } from './useRecipeRecommendations.js';

const requestA = Object.freeze({ ingredients: [{ name: 'tomato' }], resultCount: 4 });
const requestB = Object.freeze({ ingredients: [{ name: 'spinach' }], resultCount: 3 });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(status = 'ok', title = 'Tomato Bowl') {
  return {
    data: {
      status,
      recipes: status === 'no_match' ? [] : [{ id: title, title }],
      provider: { requested: 'bundled', used: 'bundled', fallbackUsed: false },
    },
  };
}

function LifecycleHarness({ recommend, onUnauthorized }) {
  const lifecycle = useRecipeRecommendations({ recommend, onUnauthorized });
  const outcomes = useRef([]);

  async function submit(request) {
    outcomes.current.push(await lifecycle.submit(request));
  }

  return (
    <div>
      <button type="button" onClick={() => submit(requestA)}>
        Submit A
      </button>
      <button type="button" onClick={() => submit(requestB)}>
        Submit B
      </button>
      <button type="button" onClick={() => lifecycle.retry()}>
        Retry
      </button>
      <button type="button" onClick={lifecycle.cancel}>
        Cancel
      </button>
      <output data-testid="lifecycle-status">{lifecycle.status}</output>
      <output data-testid="lifecycle-title">{lifecycle.data?.recipes?.[0]?.title || ''}</output>
      <output data-testid="lifecycle-error">{lifecycle.errorPresentation?.kind || ''}</output>
    </div>
  );
}

describe('useRecipeRecommendations', () => {
  it('exposes loading and stable no-match states', async () => {
    const pending = deferred();
    const recommend = vi.fn(() => pending.promise);
    render(<LifecycleHarness recommend={recommend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit A' }));
    assert.equal(screen.getByTestId('lifecycle-status').textContent, 'loading');
    assert.equal(recommend.mock.calls[0][1].signal instanceof AbortSignal, true);

    await act(async () => pending.resolve(response('no_match')));
    await waitFor(() =>
      assert.equal(screen.getByTestId('lifecycle-status').textContent, 'no-match'),
    );
  });

  it('aborts superseded work and ignores a late stale response', async () => {
    const first = deferred();
    const second = deferred();
    const recommend = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    render(<LifecycleHarness recommend={recommend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit B' }));
    assert.equal(recommend.mock.calls[0][1].signal.aborted, true);

    await act(async () => second.resolve(response('ok', 'Spinach Supper')));
    await waitFor(() =>
      assert.equal(screen.getByTestId('lifecycle-title').textContent, 'Spinach Supper'),
    );

    await act(async () => first.resolve(response('ok', 'Stale Tomato Bowl')));
    assert.equal(screen.getByTestId('lifecycle-title').textContent, 'Spinach Supper');
  });

  it('cancels active work without creating an error state', () => {
    const pending = deferred();
    const recommend = vi.fn(() => pending.promise);
    render(<LifecycleHarness recommend={recommend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit A' }));
    const signal = recommend.mock.calls[0][1].signal;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    assert.equal(signal.aborted, true);
    assert.equal(screen.getByTestId('lifecycle-status').textContent, 'idle');
    assert.equal(screen.getByTestId('lifecycle-error').textContent, '');
  });

  it('preserves the request and retries a provider failure', async () => {
    const providerError = Object.assign(new Error('private provider detail'), {
      status: 503,
      code: 'RECIPE_PROVIDER_UNAVAILABLE',
    });
    const recommend = vi
      .fn()
      .mockRejectedValueOnce(providerError)
      .mockResolvedValueOnce(response('ok', 'Recovered Recipe'));
    render(<LifecycleHarness recommend={recommend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit A' }));
    await waitFor(() =>
      assert.equal(screen.getByTestId('lifecycle-error').textContent, 'provider'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      assert.equal(screen.getByTestId('lifecycle-title').textContent, 'Recovered Recipe'),
    );

    assert.deepEqual(recommend.mock.calls[0][0], requestA);
    assert.deepEqual(recommend.mock.calls[1][0], requestA);
  });

  it('reports validation failures without retrying automatically', async () => {
    const validationError = Object.assign(new Error('Please correct the highlighted fields.'), {
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'maxTotalTimeMinutes', message: 'Time is invalid.' }],
    });
    const recommend = vi.fn().mockRejectedValue(validationError);
    render(<LifecycleHarness recommend={recommend} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit A' }));
    await waitFor(() =>
      assert.equal(screen.getByTestId('lifecycle-error').textContent, 'validation'),
    );
    assert.equal(recommend.mock.calls.length, 1);
  });

  it('refreshes authentication after an unauthorized response', async () => {
    const unauthorized = Object.assign(new Error('Session ended'), {
      status: 401,
      code: 'INVALID_SESSION',
    });
    const recommend = vi.fn().mockRejectedValue(unauthorized);
    const onUnauthorized = vi.fn();
    render(<LifecycleHarness recommend={recommend} onUnauthorized={onUnauthorized} />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit A' }));
    await waitFor(() => assert.equal(onUnauthorized.mock.calls.length, 1));
    assert.equal(screen.getByTestId('lifecycle-error').textContent, 'unauthorized');
  });
});
