import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../context/themeContext.js';

export function ThemeToggle({ className = '', compact = false }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      className={`theme-toggle${compact ? ' theme-toggle-compact' : ''} ${className}`.trim()}
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      {!compact && <span>{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
