import assert from 'node:assert/strict';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultRecipePreferences } from '../../utils/recipeRecommendationForm.js';
import { RecipePreferences } from './RecipePreferences.jsx';

function PreferencesHarness({ onSubmit = vi.fn() }) {
  const [preferences, setPreferences] = useState(createDefaultRecipePreferences);

  return (
    <RecipePreferences
      preferences={preferences}
      errors={{}}
      ingredientCount={2}
      isLoading={false}
      onChange={setPreferences}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(preferences);
      }}
      onCancel={vi.fn()}
    />
  );
}

describe('RecipePreferences', () => {
  it('distinguishes hard filters from ranking and keeps advanced limits progressive', () => {
    const { container } = render(<PreferencesHarness />);

    assert.ok(screen.getAllByText('Hard filter').length >= 2);
    assert.ok(screen.getByText('Ranking'));
    assert.ok(screen.getByText(/goal changes ranking, not eligibility/i));
    assert.equal(container.querySelector('.recipe-advanced-filters').open, false);
    assert.ok(screen.getByText('Balanced ranking'));
  });

  it('keeps every selected criterion visible and submits the controlled values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { container } = render(<PreferencesHarness onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText(/dietary preference/i), 'vegan');
    await user.selectOptions(screen.getByLabelText(/wellness goal/i), 'high-protein');
    await user.selectOptions(screen.getByLabelText(/meal type/i), 'dinner');
    await user.click(screen.getByText('Limits & result count'));
    await user.selectOptions(screen.getByLabelText(/number of ideas/i), '5');
    await user.type(screen.getByLabelText(/calories \/ serving/i), '500');
    await user.type(screen.getByLabelText(/total time/i), '30');

    assert.equal(container.querySelector('.recipe-advanced-filters').open, true);
    assert.ok(screen.getByText('3 active'));
    const currentCriteria = screen.getByLabelText(/current recommendation criteria/i);
    for (const label of [
      'Vegan',
      'Higher protein ranking',
      'Dinner only',
      'Up to 500 kcal',
      'Up to 30 min',
    ]) {
      assert.ok(within(currentCriteria).getByText(label));
    }

    await user.click(screen.getByRole('button', { name: /find 5 recipes/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      dietaryPreference: 'vegan',
      goal: 'high-protein',
      mealType: 'dinner',
      maxCaloriesPerServing: '500',
      maxTotalTimeMinutes: '30',
      resultCount: '5',
    });
  });
});
