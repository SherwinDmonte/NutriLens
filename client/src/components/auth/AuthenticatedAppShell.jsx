import { CircleUserRound, LayoutDashboard, LogOut, NotebookTabs, Utensils } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/authContext.js';
import { authenticatedNavigationItems, getActiveNavigationId } from '../../utils/appNavigation.js';
import { BrandMark } from '../BrandMark.jsx';
import { ThemeToggle } from '../ThemeToggle.jsx';
import { Button } from '../ui/Button.jsx';

const navigationIcons = Object.freeze({
  dashboard: LayoutDashboard,
  'food-log': Utensils,
  recipes: NotebookTabs,
  profile: CircleUserRound,
});

function NavigationLinks({ activeId, mobile = false }) {
  return authenticatedNavigationItems.map((item) => {
    const Icon = navigationIcons[item.id];
    const isActive = item.id === activeId;
    return (
      <Link
        className={`${mobile ? 'dashboard-mobile-nav-link' : 'dashboard-nav-link'}${isActive ? ' active' : ''}`}
        to={item.to}
        aria-label={mobile ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        key={item.id}
      >
        <Icon size={18} aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    );
  });
}

export function AuthenticatedAppShell({ children, contentId, onBeforeLogout }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = getActiveNavigationId(location);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    onBeforeLogout?.();
    try {
      await logout();
    } finally {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="dashboard-app">
      <a className="skip-link" href={`#${contentId}`}>
        Skip to page content
      </a>

      <aside className="dashboard-sidebar" aria-label="NutriLens application navigation">
        <BrandMark />
        <p className="dashboard-nav-label">Workspace</p>
        <nav className="dashboard-nav" aria-label="Primary">
          <NavigationLinks activeId={activeId} />
        </nav>

        <ThemeToggle className="dashboard-theme-toggle" />

        <Link className="dashboard-sidebar-account" to="/profile" aria-label="Open your profile">
          <span>{user?.name?.charAt(0).toUpperCase() || 'N'}</span>
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
        </Link>
        <Button
          className="dashboard-logout"
          variant="ghost"
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={17} aria-hidden="true" />
          {isLoggingOut ? 'Logging out…' : 'Log out'}
        </Button>
      </aside>

      <main className="dashboard-main" id={contentId}>
        <header className="dashboard-mobile-header">
          <BrandMark compact />
          <div className="dashboard-mobile-account">
            <ThemeToggle compact />
            <Link to="/profile" aria-label="Open your profile">
              {user?.name?.charAt(0).toUpperCase() || 'N'}
            </Link>
            <Button
              variant="ghost"
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Log out"
            >
              <LogOut size={17} aria-hidden="true" />
            </Button>
          </div>
        </header>
        {children}
      </main>
      <nav className="dashboard-mobile-nav" aria-label="Mobile primary navigation">
        <NavigationLinks activeId={activeId} mobile />
      </nav>
    </div>
  );
}
