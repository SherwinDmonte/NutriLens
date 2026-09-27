import { apiRequest } from './api.js';

export const foodCatalogApi = {
  getFood(foodId, { signal } = {}) {
    return apiRequest(`/foods/${encodeURIComponent(foodId)}`, { signal });
  },

  searchFoods(search, { signal, limit = 10 } = {}) {
    const query = new URLSearchParams({ search, limit: String(limit) });
    return apiRequest(`/foods?${query}`, { signal });
  },

  getNutritionPreview(foodId, { quantity, unit, signal } = {}) {
    const query = new URLSearchParams({ quantity: String(quantity), unit });
    return apiRequest(`/foods/${encodeURIComponent(foodId)}/nutrition?${query}`, { signal });
  },

  getCustomNutritionPreview(input, { signal } = {}) {
    return apiRequest('/foods/custom/nutrition', {
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    });
  },
};
