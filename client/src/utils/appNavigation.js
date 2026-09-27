export const APP_PATHS = Object.freeze({
  dashboard: '/dashboard',
  recipes: '/recipes',
  profile: '/profile',
});

export const authenticatedNavigationItems = Object.freeze([
  Object.freeze({ id: 'dashboard', label: 'Dashboard', to: APP_PATHS.dashboard }),
  Object.freeze({ id: 'food-log', label: 'Food log', to: `${APP_PATHS.dashboard}#food-log` }),
  Object.freeze({ id: 'recipes', label: 'Recipes', to: APP_PATHS.recipes }),
  Object.freeze({ id: 'profile', label: 'Account', to: APP_PATHS.profile }),
]);

export const protectedAppPaths = Object.freeze(Object.values(APP_PATHS));

export function getActiveNavigationId({ pathname, hash = '' }) {
  if (pathname === APP_PATHS.dashboard) return hash === '#food-log' ? 'food-log' : 'dashboard';
  if (pathname === APP_PATHS.recipes) return 'recipes';
  if (pathname === APP_PATHS.profile) return 'profile';
  return null;
}

export function isProtectedAppPath(pathname) {
  return protectedAppPaths.includes(pathname);
}
