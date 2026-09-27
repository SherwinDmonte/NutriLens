import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APP_PATHS,
  authenticatedNavigationItems,
  getActiveNavigationId,
  isProtectedAppPath,
  protectedAppPaths,
} from '../../client/src/utils/appNavigation.js';
import {
  resolveGuestRouteAccess,
  resolveProtectedRouteAccess,
} from '../../client/src/utils/routeAccess.js';

test('authenticated navigation has one stable keyboard order without duplicate destinations', () => {
  assert.deepEqual(
    authenticatedNavigationItems.map((item) => item.id),
    ['dashboard', 'food-log', 'recipes', 'profile'],
  );
  assert.equal(
    new Set(authenticatedNavigationItems.map((item) => item.to)).size,
    authenticatedNavigationItems.length,
  );
});

test('active navigation distinguishes dashboard, food log, recipes, and profile', () => {
  assert.equal(getActiveNavigationId({ pathname: '/dashboard' }), 'dashboard');
  assert.equal(getActiveNavigationId({ pathname: '/dashboard', hash: '#food-log' }), 'food-log');
  assert.equal(getActiveNavigationId({ pathname: '/recipes' }), 'recipes');
  assert.equal(getActiveNavigationId({ pathname: '/profile' }), 'profile');
  assert.equal(getActiveNavigationId({ pathname: '/unknown' }), null);
});

test('every application page behind shared navigation is marked protected', () => {
  assert.deepEqual(protectedAppPaths, [APP_PATHS.dashboard, APP_PATHS.recipes, APP_PATHS.profile]);
  assert.equal(isProtectedAppPath('/dashboard'), true);
  assert.equal(isProtectedAppPath('/recipes'), true);
  assert.equal(isProtectedAppPath('/profile'), true);
  assert.equal(isProtectedAppPath('/login'), false);
});

test('protected route access waits for restoration, allows sessions, and redirects guests', () => {
  assert.equal(resolveProtectedRouteAccess({ isAuthenticated: false, isLoading: true }), 'loading');
  assert.equal(resolveProtectedRouteAccess({ isAuthenticated: true, isLoading: false }), 'allow');
  assert.equal(
    resolveProtectedRouteAccess({ isAuthenticated: false, isLoading: false }),
    'redirect-to-login',
  );
  assert.equal(
    resolveGuestRouteAccess({ isAuthenticated: true, isLoading: false }),
    'redirect-to-dashboard',
  );
});
