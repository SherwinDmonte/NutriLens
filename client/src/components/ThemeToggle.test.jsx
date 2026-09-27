import assert from 'node:assert/strict';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it } from 'vitest';

import { ThemeProvider } from '../context/ThemeContext.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = '';
  });

  it('switches to dark mode and remembers the explicit preference', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /switch to dark theme/i }));

    await waitFor(() => assert.equal(document.documentElement.dataset.theme, 'dark'));
    assert.equal(window.localStorage.getItem('nutrilens-theme'), 'dark');
    assert.ok(screen.getByRole('button', { name: /switch to light theme/i }));
  });

  it('restores a saved dark preference without waiting for user interaction', async () => {
    window.localStorage.setItem('nutrilens-theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeToggle compact />
      </ThemeProvider>,
    );

    await waitFor(() => assert.equal(document.documentElement.dataset.theme, 'dark'));
    assert.equal(
      screen.getByRole('button', { name: /switch to light theme/i }).getAttribute('aria-pressed'),
      'true',
    );
  });

  it('keeps open tabs synchronized when the saved preference changes elsewhere', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'nutrilens-theme',
        newValue: 'dark',
      }),
    );

    await waitFor(() => assert.equal(document.documentElement.dataset.theme, 'dark'));
    assert.ok(screen.getByRole('button', { name: /switch to light theme/i }));
  });
});
