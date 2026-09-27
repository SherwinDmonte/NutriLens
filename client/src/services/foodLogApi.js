import { apiRequest } from './api.js';

export const foodLogApi = {
  create(input) {
    return apiRequest('/food-logs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update(foodLogId, input) {
    return apiRequest(`/food-logs/${encodeURIComponent(foodLogId)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  getNutritionPreview(foodLogId, { quantity, unit, signal } = {}) {
    const query = new URLSearchParams({ quantity: String(quantity), unit });
    return apiRequest(`/food-logs/${encodeURIComponent(foodLogId)}/nutrition?${query}`, {
      signal,
    });
  },

  delete(foodLogId) {
    return apiRequest(`/food-logs/${encodeURIComponent(foodLogId)}`, {
      method: 'DELETE',
    });
  },

  listForDate(date, { signal } = {}) {
    const query = new URLSearchParams({ date, page: '1', limit: '100' });
    return apiRequest(`/food-logs?${query}`, { signal });
  },

  getDailySummary(date, { signal } = {}) {
    const query = new URLSearchParams({ date });
    return apiRequest(`/food-logs/summary?${query}`, { signal });
  },

  async getDailyDashboard(date, { signal } = {}) {
    const [foodLogsResponse, summaryResponse] = await Promise.all([
      foodLogApi.listForDate(date, { signal }),
      foodLogApi.getDailySummary(date, { signal }),
    ]);

    return {
      foodLogs: foodLogsResponse.data.foodLogs,
      summary: summaryResponse.data.summary,
    };
  },
};
