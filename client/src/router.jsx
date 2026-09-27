import { createBrowserRouter } from 'react-router-dom';

import { GuestRoute, ProtectedRoute } from './components/auth/RouteGuards.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { RecipesPage } from './pages/RecipesPage.jsx';
import { APP_PATHS } from './utils/appNavigation.js';

export const appRouter = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    path: '/register',
    element: (
      <GuestRoute>
        <AuthPage mode="register" />
      </GuestRoute>
    ),
  },
  {
    path: '/login',
    element: (
      <GuestRoute>
        <AuthPage mode="login" />
      </GuestRoute>
    ),
  },
  {
    path: APP_PATHS.dashboard,
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: APP_PATHS.recipes,
    element: (
      <ProtectedRoute>
        <RecipesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: APP_PATHS.profile,
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
]);
