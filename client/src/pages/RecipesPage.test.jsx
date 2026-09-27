import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { RecipeViewSwitch } from './RecipesPage.jsx';

function StatefulRecipeViewSwitch() {
  const [activeView, setActiveView] = useState('discover');
  return <RecipeViewSwitch activeView={activeView} onChange={setActiveView} savedCount={3} />;
}

describe('RecipeViewSwitch', () => {
  it('exposes connected tabs and supports arrow, Home, and End keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<StatefulRecipeViewSwitch />);

    const discoverTab = screen.getByRole('tab', { name: /find recipes/i });
    const savedTab = screen.getByRole('tab', { name: /saved recipes, 3 saved/i });

    expect(discoverTab.getAttribute('aria-controls')).toBe('recipe-discover-panel');
    expect(savedTab.getAttribute('aria-controls')).toBe('recipe-saved-panel');
    expect(discoverTab.getAttribute('aria-selected')).toBe('true');
    expect(savedTab.getAttribute('tabindex')).toBe('-1');

    discoverTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(savedTab);
    expect(savedTab.getAttribute('aria-selected')).toBe('true');
    expect(discoverTab.getAttribute('tabindex')).toBe('-1');

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(discoverTab);
    expect(discoverTab.getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(savedTab);
    expect(savedTab.getAttribute('aria-selected')).toBe('true');
  });
});
