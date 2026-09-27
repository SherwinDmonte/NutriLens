import { apiRequest } from './api.js';

export const authApi = {
  register(credentials) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  login(credentials) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  getSession() {
    return apiRequest('/auth/me');
  },

  logout() {
    return apiRequest('/auth/logout', { method: 'POST' });
  },
};
