import { apiRequest } from './api.js';

export const recipeApi = {
  recommend(input, { signal } = {}) {
    return apiRequest('/recipes/recommend', {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    });
  },
  save(recipe, provider) {
    return apiRequest('/recipes/saved', {
      method: 'POST',
      body: JSON.stringify({ recipe, provider }),
    });
  },
  listSaved({ page = 1, limit = 12 } = {}, { signal } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    return apiRequest(`/recipes/saved?${query}`, { signal });
  },
  getSaved(savedRecipeId, { signal } = {}) {
    return apiRequest(`/recipes/saved/${savedRecipeId}`, { signal });
  },
  removeSaved(savedRecipeId) {
    return apiRequest(`/recipes/saved/${savedRecipeId}`, { method: 'DELETE' });
  },
};
