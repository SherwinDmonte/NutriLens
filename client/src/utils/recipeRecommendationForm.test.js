import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  buildRecipeRecommendationRequest,
  createDefaultRecipePreferences,
  countAdvancedRecipePreferences,
  describeRecipeRequestError,
  getRecipeCriteria,
  mapRecipeApiFieldErrors,
} from './recipeRecommendationForm.js';

describe('recipe recommendation form', () => {
  it('builds a request with neutral defaults and request-ready optional ingredient quantities', () => {
    const result = buildRecipeRecommendationRequest({
      ingredients: [{ name: 'chickpeas', quantity: 2.5, unit: 'cup' }, { name: 'spinach' }],
      preferences: createDefaultRecipePreferences(),
    });

    assert.deepEqual(result.errors, {});
    assert.deepEqual(result.request, {
      ingredients: [{ name: 'chickpeas', quantity: 2.5, unit: 'cup' }, { name: 'spinach' }],
      dietaryPreference: 'none',
      goal: 'balanced',
      mealType: 'any',
      resultCount: 4,
    });
  });

  it('converts every selected filter to the strict API request shape', () => {
    const result = buildRecipeRecommendationRequest({
      ingredients: [{ name: 'tofu' }],
      preferences: {
        dietaryPreference: 'vegan',
        goal: 'high-protein',
        mealType: 'dinner',
        maxCaloriesPerServing: '650',
        maxTotalTimeMinutes: '45',
        resultCount: '5',
      },
    });

    assert.deepEqual(result.request, {
      ingredients: [{ name: 'tofu' }],
      dietaryPreference: 'vegan',
      goal: 'high-protein',
      mealType: 'dinner',
      maxCaloriesPerServing: 650,
      maxTotalTimeMinutes: 45,
      resultCount: 5,
    });
  });

  it('describes active hard filters separately from the goal ranking preference', () => {
    const criteria = getRecipeCriteria({
      dietaryPreference: 'vegan',
      goal: 'high-protein',
      mealType: 'dinner',
      maxCaloriesPerServing: '500',
      maxTotalTimeMinutes: 30,
    });

    assert.deepEqual(criteria, [
      { key: 'dietaryPreference', label: 'Vegan', type: 'filter' },
      { key: 'goal', label: 'Higher protein ranking', type: 'ranking' },
      { key: 'mealType', label: 'Dinner only', type: 'filter' },
      { key: 'maxCaloriesPerServing', label: 'Up to 500 kcal', type: 'filter' },
      { key: 'maxTotalTimeMinutes', label: 'Up to 30 min', type: 'filter' },
    ]);
    assert.equal(
      countAdvancedRecipePreferences({
        resultCount: '5',
        maxCaloriesPerServing: '500',
        maxTotalTimeMinutes: '',
      }),
      2,
    );
  });

  it('rejects missing ingredients, unsupported choices, decimals, and out-of-range limits', () => {
    const result = buildRecipeRecommendationRequest({
      ingredients: [],
      preferences: {
        dietaryPreference: 'pescatarian',
        goal: 'medical',
        mealType: 'brunch',
        maxCaloriesPerServing: '99',
        maxTotalTimeMinutes: '5.5',
        resultCount: '6',
      },
    });

    assert.equal(result.request, null);
    assert.deepEqual(Object.keys(result.errors).sort(), [
      'dietaryPreference',
      'goal',
      'ingredients',
      'maxCaloriesPerServing',
      'maxTotalTimeMinutes',
      'mealType',
      'resultCount',
    ]);
  });

  it('maps nested server validation details and classifies actionable errors', () => {
    assert.deepEqual(
      mapRecipeApiFieldErrors({
        details: [
          { field: 'ingredients.0.name', message: 'Ingredient is invalid.' },
          { field: 'maxTotalTimeMinutes', message: 'Time is invalid.' },
          { field: 'userId', message: 'Ignored authority field.' },
        ],
      }),
      {
        ingredients: 'Ingredient is invalid.',
        maxTotalTimeMinutes: 'Time is invalid.',
      },
    );

    assert.equal(describeRecipeRequestError({ status: 401 }).kind, 'unauthorized');
    assert.equal(
      describeRecipeRequestError({ status: 503, code: 'RECIPE_PROVIDER_UNAVAILABLE' }).kind,
      'provider',
    );
    assert.equal(describeRecipeRequestError(new TypeError('fetch failed')).kind, 'network');
    assert.equal(
      describeRecipeRequestError(new TypeError('fetch failed'), { online: false }).title,
      'You appear to be offline',
    );
  });
});
