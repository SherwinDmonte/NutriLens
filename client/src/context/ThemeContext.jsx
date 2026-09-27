import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ThemeContext } from './themeContext.js';

const STORAGE_KEY = 'nutrilens-theme';
const DARK_THEME_COLOR = '#0c1511';
const LIGHT_THEME_COLOR = '#f5f7f3';
const DARK_FAVICON = '/brand/nutrilens-focus-leaf-icon-dark.svg';
const LIGHT_FAVICON = '/brand/nutrilens-focus-leaf-icon-light.svg';

function readStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null;
  } catch {
    return null;
  }
}

function getInitialTheme() {
  const documentTheme = document.documentElement.dataset.theme;
  if (documentTheme === 'light' || documentTheme === 'dark') return documentTheme;

  const storedTheme = readStoredTheme();
  if (storedTheme) return storedTheme;

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  document
    .querySelector('#app-favicon')
    ?.setAttribute('href', theme === 'dark' ? DARK_FAVICON : LIGHT_FAVICON);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const hasExplicitPreference = useRef(Boolean(readStoredTheme()));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      if (!hasExplicitPreference.current) setTheme(event.matches ? 'dark' : 'light');
    };
    preference.addEventListener('change', handleChange);
    return () => preference.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;

      const nextTheme =
        event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : null;
      hasExplicitPreference.current = Boolean(nextTheme);
      setTheme(
        nextTheme ||
          (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      );
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      hasExplicitPreference.current = true;
      try {
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {
        // Theme still changes for this session when storage is unavailable.
      }
      return nextTheme;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggleTheme,
    }),
    [theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
