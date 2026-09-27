import { toRecipeIngredientRequest } from './recipeIngredients.js';

export const RECIPE_FILTER_LIMITS = Object.freeze({
  calories: Object.freeze({ min: 100, max: 1_500 }),
  timeMinutes: Object.freeze({ min: 5, max: 240 }),
  resultCount: Object.freeze({ min: 3, max: 5 }),
});

export const DIETARY_OPTIONS = Object.freeze([
  Object.freeze({ value: 'none', label: 'No dietary filter' }),
  Object.freeze({ value: 'vegetarian', label: 'Vegetarian' }),
  Object.freeze({ value: 'eggetarian', label: 'Eggetarian' }),
  Object.freeze({ value: 'vegan', label: 'Vegan' }),
]);

export const RECIPE_GOAL_OPTIONS = Object.freeze([
  Object.freeze({ value: 'balanced', label: 'Balanced' }),
  Object.freeze({ value: 'high-protein', label: 'Higher protein' }),
  Object.freeze({ value: 'high-fiber', label: 'Higher fiber' }),
  Object.freeze({ value: 'lower-calorie', label: 'Lower calorie' }),
]);

export const RECIPE_MEAL_OPTIONS = Object.freeze([
  Object.freeze({ value: 'any', label: 'Any meal' }),
  Object.freeze({ value: 'breakfast', label: 'Breakfast' }),
  Object.freeze({ value: 'lunch', label: 'Lunch' }),
  Object.freeze({ value: 'dinner', label: 'Dinner' }),
  Object.freeze({ value: 'snack', label: 'Snack' }),
]);

const dietaryValues = new Set(DIETARY_OPTIONS.map(({ value }) => value));
const goalValues = new Set(RECIPE_GOAL_OPTIONS.map(({ value }) => value));
const mealValues = new Set(RECIPE_MEAL_OPTIONS.map(({ value }) => value));

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label;
}

export function getRecipeCriteria(criteria = {}) {
  const descriptions = [];
  const dietaryLabel = optionLabel(DIETARY_OPTIONS, criteria.dietaryPreference);
  const goalLabel = optionLabel(RECIPE_GOAL_OPTIONS, criteria.goal);
  const mealLabel = optionLabel(RECIPE_MEAL_OPTIONS, criteria.mealType);

  if (dietaryLabel && criteria.dietaryPreference !== 'none') {
    descriptions.push({ key: 'dietaryPreference', label: dietaryLabel, type: 'filter' });
  }
  if (goalLabel) {
    descriptions.push({ key: 'goal', label: `${goalLabel} ranking`, type: 'ranking' });
  }
  if (mealLabel && criteria.mealType !== 'any') {
    descriptions.push({ key: 'mealType', label: `${mealLabel} only`, type: 'filter' });
  }
  if (criteria.maxCaloriesPerServing !== '' && criteria.maxCaloriesPerServing != null) {
    descriptions.push({
      key: 'maxCaloriesPerServing',
      label: `Up to ${criteria.maxCaloriesPerServing} kcal`,
      type: 'filter',
    });
  }
  if (criteria.maxTotalTimeMinutes !== '' && criteria.maxTotalTimeMinutes != null) {
    descriptions.push({
      key: 'maxTotalTimeMinutes',
      label: `Up to ${criteria.maxTotalTimeMinutes} min`,
      type: 'filter',
    });
  }

  return descriptions;
}

export function countAdvancedRecipePreferences(preferences = {}) {
  return [
    preferences.resultCount !== undefined && String(preferences.resultCount) !== '4',
    preferences.maxCaloriesPerServing !== '' && preferences.maxCaloriesPerServing != null,
    preferences.maxTotalTimeMinutes !== '' && preferences.maxTotalTimeMinutes != null,
  ].filter(Boolean).length;
}

export function createDefaultRecipePreferences() {
  return {
    dietaryPreference: 'none',
    goal: 'balanced',
    mealType: 'any',
    maxCaloriesPerServing: '',
    maxTotalTimeMinutes: '',
    resultCount: '4',
  };
}

function boundedInteger(value, { field, label, min, max, optional = false }, errors) {
  if (optional && (value === '' || value === undefined || value === null)) return undefined;

  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    errors[field] = `${label} must be a whole number from ${min} to ${max}.`;
    return undefined;
  }
  return number;
}

export function buildRecipeRecommendationRequest({ ingredients, preferences }) {
  const errors = {};
  const normalizedIngredients = toRecipeIngredientRequest(ingredients || []);

  if (normalizedIngredients.length === 0) {
    errors.ingredients = 'Add at least one ingredient before finding recipes.';
  }
  if (!dietaryValues.has(preferences?.dietaryPreference)) {
    errors.dietaryPreference = 'Choose a supported dietary preference.';
  }
  if (!goalValues.has(preferences?.goal)) {
    errors.goal = 'Choose a supported wellness goal.';
  }
  if (!mealValues.has(preferences?.mealType)) {
    errors.mealType = 'Choose a supported meal type.';
  }

  const maxCaloriesPerServing = boundedInteger(
    preferences?.maxCaloriesPerServing,
    {
      field: 'maxCaloriesPerServing',
      label: 'Maximum calories',
      ...RECIPE_FILTER_LIMITS.calories,
      optional: true,
    },
    errors,
  );
  const maxTotalTimeMinutes = boundedInteger(
    preferences?.maxTotalTimeMinutes,
    {
      field: 'maxTotalTimeMinutes',
      label: 'Maximum cooking time',
      ...RECIPE_FILTER_LIMITS.timeMinutes,
      optional: true,
    },
    errors,
  );
  const resultCount = boundedInteger(
    preferences?.resultCount,
    {
      field: 'resultCount',
      label: 'Result count',
      ...RECIPE_FILTER_LIMITS.resultCount,
    },
    errors,
  );

  if (Object.keys(errors).length > 0) return { request: null, errors };

  return {
    errors,
    request: {
      ingredients: normalizedIngredients,
      dietaryPreference: preferences.dietaryPreference,
      goal: preferences.goal,
      mealType: preferences.mealType,
      ...(maxCaloriesPerServing !== undefined ? { maxCaloriesPerServing } : {}),
      ...(maxTotalTimeMinutes !== undefined ? { maxTotalTimeMinutes } : {}),
      resultCount,
    },
  };
}

export function mapRecipeApiFieldErrors(error) {
  if (!Array.isArray(error?.details)) return {};

  return error.details.reduce((fields, detail) => {
    const rootField = String(detail.field || '').split('.')[0];
    if (
      [
        'ingredients',
        'dietaryPreference',
        'goal',
        'mealType',
        'maxCaloriesPerServing',
        'maxTotalTimeMinutes',
        'resultCount',
      ].includes(rootField) &&
      !fields[rootField]
    ) {
      fields[rootField] = detail.message;
    }
    return fields;
  }, {});
}

export function describeRecipeRequestError(error, { online = true } = {}) {
  if (error?.name === 'AbortError') {
    return { kind: 'cancelled', title: 'Request cancelled', message: '', retryable: false };
  }
  if (error?.status === 401) {
    return {
      kind: 'unauthorized',
      title: 'Your session has ended',
      message: 'Sign in again to request recipe recommendations.',
      retryable: false,
    };
  }
  if (error?.code === 'VALIDATION_ERROR' || error?.status === 400) {
    return {
      kind: 'validation',
      title: 'Review your recipe request',
      message: error?.message || 'Please correct the highlighted fields.',
      retryable: false,
    };
  }
  if (error?.code === 'RECOMMENDATION_RATE_LIMITED' || error?.status === 429) {
    return {
      kind: 'rate-limit',
      title: 'Recipe requests are paused briefly',
      message: 'You reached the request limit. Wait a few minutes, then try again.',
      retryable: true,
    };
  }
  if (error?.code === 'RECIPE_PROVIDER_UNAVAILABLE' || error?.status === 503) {
    return {
      kind: 'provider',
      title: 'Recommendations are temporarily unavailable',
      message: 'Your ingredients are still here. Retry the same request in a moment.',
      retryable: true,
    };
  }
  if (!error?.status || error instanceof TypeError) {
    return {
      kind: 'network',
      title: online ? 'Could not reach NutriLens' : 'You appear to be offline',
      message: online
        ? 'Check that the NutriLens server is running, then retry your request.'
        : 'Reconnect to the internet or local network, then retry your request.',
      retryable: true,
    };
  }
  return {
    kind: 'unknown',
    title: 'The recipe request did not finish',
    message: error?.message || 'Try the same request again.',
    retryable: true,
  };
}
