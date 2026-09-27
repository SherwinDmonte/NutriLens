import assert from 'node:assert/strict';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, it } from 'vitest';

import { ThemeProvider } from '../context/ThemeContext.jsx';
import { BrandMark } from './BrandMark.jsx';

function renderBrandMark(props = {}) {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <BrandMark {...props} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('BrandMark', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('uses the selected Focus Leaf artwork for the active theme', () => {
    window.localStorage.setItem('nutrilens-theme', 'dark');
    renderBrandMark();

    const mark = screen.getByRole('link', { name: /nutrilens home/i }).querySelector('img');
    assert.match(mark.getAttribute('src'), /nutrilens-focus-leaf-icon-dark\.svg$/);
    assert.ok(screen.getByText('NutriLens'));
  });

  it('supports a dark-surface compact mark without displaying a duplicate wordmark', () => {
    renderBrandMark({ compact: true, tone: 'dark' });

    const mark = screen.getByRole('link', { name: /nutrilens home/i }).querySelector('img');
    assert.match(mark.getAttribute('src'), /nutrilens-focus-leaf-icon-dark\.svg$/);
    assert.equal(screen.queryByText('NutriLens'), null);
  });
});
