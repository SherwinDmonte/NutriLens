import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { recipeFixture, recipeResponseDataFixture } from '../test/recipeFixtures.js';
import { useSavedRecipes } from './useSavedRecipes.js';

const savedRecipe = {
  id: '68d6c9df1d9a6c7f94b81111',
  fingerprint: 'a'.repeat(64),
  recipe: recipeFixture,
  provider: recipeResponseDataFixture.provider,
  createdAt: '2026-09-26T10:00:00.000Z',
  updatedAt: '2026-09-26T10:00:00.000Z',
};

function listResponse(items) {
  return {
    data: { savedRecipes: items },
    meta: {
      pagination: {
        page: 1,
        limit: 12,
        total: items.length,
        totalPages: items.length ? 1 : 0,
      },
    },
  };
}

describe('useSavedRecipes', () => {
  it('loads, explicitly saves, refreshes, and explicitly removes snapshots', async () => {
    const api = {
      listSaved: vi
        .fn()
        .mockResolvedValueOnce(listResponse([]))
        .mockResolvedValueOnce(listResponse([savedRecipe]))
        .mockResolvedValueOnce(listResponse([])),
      save: vi.fn().mockResolvedValue({ data: { savedRecipe } }),
      removeSaved: vi.fn().mockResolvedValue(null),
    };
    const { result } = renderHook(() => useSavedRecipes({ api }));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.savedRecipes).toEqual([]);

    await act(() => result.current.save(recipeFixture, recipeResponseDataFixture.provider));
    await waitFor(() => expect(result.current.savedRecipes).toHaveLength(1));
    expect(api.save).toHaveBeenCalledWith(recipeFixture, recipeResponseDataFixture.provider);
    expect(result.current.savedRecipeSourceIds.has(recipeFixture.id)).toBe(true);
    expect(result.current.feedback.message).toMatch(/was saved/i);

    await act(() => result.current.remove(savedRecipe));
    await waitFor(() => expect(result.current.savedRecipes).toEqual([]));
    expect(api.removeSaved).toHaveBeenCalledWith(savedRecipe.id);
    expect(result.current.feedback.message).toMatch(/was removed/i);
  });

  it('turns duplicate-save conflicts into honest feedback and refreshes collection state', async () => {
    const duplicate = Object.assign(new Error('duplicate'), {
      status: 409,
      code: 'RECIPE_ALREADY_SAVED',
    });
    const api = {
      listSaved: vi
        .fn()
        .mockResolvedValueOnce(listResponse([]))
        .mockResolvedValueOnce(listResponse([savedRecipe])),
      save: vi.fn().mockRejectedValue(duplicate),
      removeSaved: vi.fn(),
    };
    const { result } = renderHook(() => useSavedRecipes({ api }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(() => result.current.save(recipeFixture, recipeResponseDataFixture.provider));
    await waitFor(() => expect(result.current.savedRecipes).toHaveLength(1));
    expect(result.current.feedback.message).toBe('That recipe is already saved.');
    expect(result.current.feedback.tone).toBe('neutral');
  });

  it('coalesces rapid duplicate save requests before React state is committed', async () => {
    let resolveSave;
    const saveRequest = new Promise((resolve) => {
      resolveSave = resolve;
    });
    const api = {
      listSaved: vi
        .fn()
        .mockResolvedValueOnce(listResponse([]))
        .mockResolvedValueOnce(listResponse([savedRecipe])),
      save: vi.fn().mockReturnValue(saveRequest),
      removeSaved: vi.fn(),
    };
    const { result } = renderHook(() => useSavedRecipes({ api }));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let firstRequest;
    let duplicateRequest;
    act(() => {
      firstRequest = result.current.save(recipeFixture, recipeResponseDataFixture.provider);
      duplicateRequest = result.current.save(recipeFixture, recipeResponseDataFixture.provider);
    });

    expect(api.save).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSave({ data: { savedRecipe } });
      await Promise.all([firstRequest, duplicateRequest]);
    });
    await waitFor(() => expect(result.current.savedRecipes).toHaveLength(1));
  });
});
