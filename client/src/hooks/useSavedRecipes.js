import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { recipeApi } from '../services/recipeApi.js';

const PAGE_SIZE = 12;
const emptyPagination = Object.freeze({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });

function actionErrorMessage(error, action) {
  if (error?.status === 401) return 'Your session expired. Please log in again.';
  if (error?.code === 'RECIPE_ALREADY_SAVED') return 'That recipe is already saved.';
  if (error?.code === 'SAVED_RECIPE_NOT_FOUND') return 'That saved recipe no longer exists.';
  return error?.message || `The recipe could not be ${action}. Please try again.`;
}

export function useSavedRecipes({ onUnauthorized, api = recipeApi } = {}) {
  const [status, setStatus] = useState('loading');
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [savingRecipeIds, setSavingRecipeIds] = useState([]);
  const [removingSavedRecipeIds, setRemovingSavedRecipeIds] = useState([]);
  const listController = useRef(null);
  const savingRecipeIdsRef = useRef(new Set());
  const removingSavedRecipeIdsRef = useRef(new Set());

  const load = useCallback(
    async (page = 1) => {
      listController.current?.abort();
      const controller = new AbortController();
      listController.current = controller;
      setStatus('loading');
      setError(null);

      try {
        const response = await api.listSaved(
          { page, limit: PAGE_SIZE },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setSavedRecipes(response.data.savedRecipes);
        setPagination(response.meta.pagination);
        setStatus('ready');
      } catch (loadError) {
        if (controller.signal.aborted || loadError?.name === 'AbortError') return;
        setStatus('error');
        setError(actionErrorMessage(loadError, 'loaded'));
        if (loadError?.status === 401) void onUnauthorized?.();
      } finally {
        if (listController.current === controller) listController.current = null;
      }
    },
    [api, onUnauthorized],
  );

  useEffect(() => {
    const controller = new AbortController();
    listController.current = controller;

    api
      .listSaved({ page: 1, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setSavedRecipes(response.data.savedRecipes);
        setPagination(response.meta.pagination);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (controller.signal.aborted || loadError?.name === 'AbortError') return;
        setStatus('error');
        setError(actionErrorMessage(loadError, 'loaded'));
        if (loadError?.status === 401) void onUnauthorized?.();
      })
      .finally(() => {
        if (listController.current === controller) listController.current = null;
      });

    return () => controller.abort();
  }, [api, onUnauthorized]);

  const save = useCallback(
    async (recipe, provider) => {
      if (savingRecipeIdsRef.current.has(recipe.id)) return;
      savingRecipeIdsRef.current.add(recipe.id);
      setSavingRecipeIds((current) => [...current, recipe.id]);
      setFeedback(null);
      try {
        await api.save(recipe, provider);
        await load(1);
        setFeedback({ tone: 'success', message: `${recipe.title} was saved.` });
      } catch (saveError) {
        if (saveError?.code === 'RECIPE_ALREADY_SAVED') await load(1);
        setFeedback({
          tone: saveError?.code === 'RECIPE_ALREADY_SAVED' ? 'neutral' : 'error',
          message: actionErrorMessage(saveError, 'saved'),
        });
        if (saveError?.status === 401) void onUnauthorized?.();
      } finally {
        savingRecipeIdsRef.current.delete(recipe.id);
        setSavingRecipeIds((current) => current.filter((recipeId) => recipeId !== recipe.id));
      }
    },
    [api, load, onUnauthorized],
  );

  const remove = useCallback(
    async (savedRecipe) => {
      if (removingSavedRecipeIdsRef.current.has(savedRecipe.id)) return;
      removingSavedRecipeIdsRef.current.add(savedRecipe.id);
      setRemovingSavedRecipeIds((current) => [...current, savedRecipe.id]);
      setFeedback(null);
      try {
        await api.removeSaved(savedRecipe.id);
        const remainingOnPage = savedRecipes.length - 1;
        const targetPage =
          remainingOnPage === 0 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
        await load(targetPage);
        setFeedback({ tone: 'success', message: `${savedRecipe.recipe.title} was removed.` });
      } catch (removeError) {
        if (removeError?.code === 'SAVED_RECIPE_NOT_FOUND') await load(pagination.page);
        setFeedback({ tone: 'error', message: actionErrorMessage(removeError, 'removed') });
        if (removeError?.status === 401) void onUnauthorized?.();
      } finally {
        removingSavedRecipeIdsRef.current.delete(savedRecipe.id);
        setRemovingSavedRecipeIds((current) =>
          current.filter((savedRecipeId) => savedRecipeId !== savedRecipe.id),
        );
      }
    },
    [api, load, onUnauthorized, pagination.page, savedRecipes.length],
  );

  const savedRecipeSourceIds = useMemo(
    () => new Set(savedRecipes.map((savedRecipe) => savedRecipe.recipe.id)),
    [savedRecipes],
  );

  return {
    status,
    savedRecipes,
    savedRecipeSourceIds,
    pagination,
    error,
    feedback,
    savingRecipeIds,
    removingSavedRecipeIds,
    load,
    save,
    remove,
  };
}
