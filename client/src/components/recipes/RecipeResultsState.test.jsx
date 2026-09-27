import assert from 'node:assert/strict';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, vi } from 'vitest';

import { recipeFixture, recipeResponseDataFixture } from '../../test/recipeFixtures.js';
import { RecipeResultsState } from './RecipeResultsState.jsx';

const baseProps = {
  data: null,
  error: null,
  ingredientCount: 2,
  onCancel: vi.fn(),
  onRetry: vi.fn(),
  onResetFilters: vi.fn(),
  onReviewInputs: vi.fn(),
};

describe('RecipeResultsState', () => {
  it('provides cancel feedback while loading and filter recovery for no-match results', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <RecipeResultsState {...baseProps} status="loading" onCancel={onCancel} />,
    );
    assert.equal(
      screen
        .getByText(/finding practical recipes/i)
        .closest('[aria-busy]')
        .getAttribute('aria-busy'),
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel request/i }));
    assert.equal(onCancel.mock.calls.length, 1);

    const onResetFilters = vi.fn();
    rerender(
      <RecipeResultsState {...baseProps} status="no-match" onResetFilters={onResetFilters} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /reset optional filters/i }));
    assert.equal(onResetFilters.mock.calls.length, 1);
  });

  it('renders complete validated recommendation cards for successful results', () => {
    render(
      <RecipeResultsState
        {...baseProps}
        status="success"
        data={{
          ...recipeResponseDataFixture,
          recipes: [
            recipeFixture,
            { ...recipeFixture, id: 'second', title: 'Spinach Rice Skillet' },
          ],
        }}
      />,
    );

    assert.ok(screen.getByText(/2 validated recipe matches ready/i));
    assert.ok(screen.getByLabelText(/recommended recipes/i));
    assert.ok(screen.getByText('Spinach Rice Skillet'));
    assert.equal(screen.getAllByRole('button', { name: /view full recipe/i }).length, 2);
  });

  it('offers retry for provider errors and input review for validation errors', () => {
    const onRetry = vi.fn();
    const onReviewInputs = vi.fn();
    const { rerender } = render(
      <RecipeResultsState
        {...baseProps}
        status="error"
        error={{ kind: 'provider', title: 'Unavailable', message: 'Try again.', retryable: true }}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry request/i }));
    assert.equal(onRetry.mock.calls.length, 1);

    rerender(
      <RecipeResultsState
        {...baseProps}
        status="error"
        error={{ kind: 'validation', title: 'Review', message: 'Fix fields.', retryable: false }}
        onReviewInputs={onReviewInputs}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /review inputs/i }));
    assert.equal(onReviewInputs.mock.calls.length, 1);
  });
});
