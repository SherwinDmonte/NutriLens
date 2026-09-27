export function resolveProtectedRouteAccess({ isAuthenticated, isLoading }) {
  if (isLoading) return 'loading';
  return isAuthenticated ? 'allow' : 'redirect-to-login';
}

export function resolveGuestRouteAccess({ isAuthenticated, isLoading }) {
  if (isLoading) return 'loading';
  return isAuthenticated ? 'redirect-to-dashboard' : 'allow';
}
