import assert from 'node:assert/strict';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { recipeFixture, recipeResponseDataFixture } from '../../test/recipeFixtures.js';
import { SavedRecipesPanel } from './SavedRecipesPanel.jsx';

const savedRecipe = {
  id: '68d6c9df1d9a6c7f94b81111',
  fingerprint: 'a'.repeat(64),
  recipe: recipeFixture,
  provider: recipeResponseDataFixture.provider,
  createdAt: '2026-09-26T10:00:00.000Z',
  updatedAt: '2026-09-26T10:00:00.000Z',
};

function panelState(overrides = {}) {
  return {
    status: 'ready',
    savedRecipes: [savedRecipe],
    pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
    error: null,
    feedback: null,
    removingSavedRecipeIds: [],
    load: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

describe('SavedRecipesPanel', () => {
  it('shows a clear empty state without implying automatic saving', () => {
    render(
      <SavedRecipesPanel
        savedRecipes={panelState({
          savedRecipes: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
        })}
      />,
    );

    assert.ok(screen.getByText(/no saved recipes yet/i));
    assert.ok(screen.getByText(/use save recipe to build a private collection/i));
  });

  it('reuses complete recipe details and removes only through an explicit action', async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    render(<SavedRecipesPanel savedRecipes={panelState({ remove })} />);

    await user.click(
      screen.getByRole('button', { name: `View full recipe: ${recipeFixture.title}` }),
    );
    const dialog = await screen.findByRole('dialog');
    assert.ok(within(dialog).getByText(/estimated nutrition per serving/i));
    await user.click(within(dialog).getByRole('button', { name: /close recipe/i }));
    await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));

    await user.click(
      screen.getByRole('button', { name: `Remove saved recipe: ${recipeFixture.title}` }),
    );
    expect(remove).toHaveBeenCalledWith(savedRecipe);
  });

  it('shows save and remove feedback in a live status region', () => {
    render(
      <SavedRecipesPanel
        savedRecipes={panelState({
          feedback: { tone: 'success', message: `${recipeFixture.title} was saved.` },
        })}
      />,
    );

    assert.ok(screen.getByRole('status', { name: '' }));
    assert.ok(screen.getByText(`${recipeFixture.title} was saved.`));
  });
});
