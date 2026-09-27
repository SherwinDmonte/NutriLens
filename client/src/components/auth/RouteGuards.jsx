import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/authContext.js';
import { resolveGuestRouteAccess, resolveProtectedRouteAccess } from '../../utils/routeAccess.js';
import { BrandMark } from '../BrandMark.jsx';

function SessionLoading() {
  return (
    <main className="session-loading" aria-live="polite">
      <span className="session-loading-brand">
        <BrandMark compact />
        <span className="session-loading-mark" aria-hidden="true" />
      </span>
      <p>Preparing your NutriLens session…</p>
    </main>
  );
}

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const access = resolveProtectedRouteAccess({ isAuthenticated, isLoading });

  if (access === 'loading') return <SessionLoading />;
  if (access === 'redirect-to-login') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function GuestRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const access = resolveGuestRouteAccess({ isAuthenticated, isLoading });

  if (access === 'loading') return <SessionLoading />;
  if (access === 'redirect-to-dashboard') return <Navigate to="/dashboard" replace />;

  return children;
}
