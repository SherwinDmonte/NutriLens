export const RECIPE_CONTRACT_VERSION = '2';

export const DIETARY_PREFERENCES = Object.freeze(['none', 'vegetarian', 'eggetarian', 'vegan']);

export const RECIPE_GOALS = Object.freeze([
  'balanced',
  'high-protein',
  'high-fiber',
  'lower-calorie',
]);

export const RECIPE_MEAL_TYPES = Object.freeze(['any', 'breakfast', 'lunch', 'dinner', 'snack']);

export const PROVIDER_MEAL_TYPES = Object.freeze(['breakfast', 'lunch', 'dinner', 'snack']);

export const RECIPE_DIFFICULTIES = Object.freeze(['easy', 'medium', 'advanced']);
export const RECIPE_PROVIDERS = Object.freeze(['gemini', 'bundled']);
export const RECIPE_IMAGE_PROVIDERS = Object.freeze(['cloudflare']);
export const NUTRITION_PROVIDERS = Object.freeze(['bundled']);
export const NUTRITION_CONFIDENCE_LEVELS = Object.freeze(['low', 'medium', 'high']);
export const NUTRITION_ASSUMPTION_CODES = Object.freeze([
  'default_quantity',
  'default_unit',
  'ingredient_specific_conversion',
  'optional_ingredient_excluded',
  'unknown_ingredient',
  'unsupported_conversion',
]);

export const RECIPE_FALLBACK_REASONS = Object.freeze([
  'missing_configuration',
  'rate_limited',
  'quota_exhausted',
  'timeout',
  'unavailable',
  'safety_refusal',
  'invalid_output',
]);

export const RECIPE_UNITS = Object.freeze([
  'grams',
  'kilograms',
  'milliliters',
  'liters',
  'teaspoon',
  'tablespoon',
  'cup',
  'piece',
  'serving',
]);

export const RECIPE_LIMITS = Object.freeze({
  ingredientsPerRequest: Object.freeze({ min: 1, max: 20 }),
  ingredientsPerRecipe: Object.freeze({ min: 1, max: 30 }),
  ingredientNameLength: Object.freeze({ min: 1, max: 80 }),
  ingredientQuantity: Object.freeze({ minExclusive: 0, max: 10_000 }),
  recipesPerResponse: Object.freeze({ min: 3, max: 5, default: 4 }),
  stepsPerRecipe: Object.freeze({ min: 1, max: 20 }),
  titleLength: Object.freeze({ min: 1, max: 100 }),
  summaryLength: Object.freeze({ min: 1, max: 300 }),
  stepLength: Object.freeze({ min: 1, max: 500 }),
  reasonLength: Object.freeze({ min: 1, max: 240 }),
  servings: Object.freeze({ min: 1, max: 12 }),
  minutes: Object.freeze({ min: 0, max: 240 }),
  maxCaloriesPerServing: Object.freeze({ min: 100, max: 1_500 }),
  maxTotalTimeMinutes: Object.freeze({ min: 5, max: 240 }),
});

export const RECIPE_SCORING_WEIGHTS = Object.freeze({
  ingredient: 0.4,
  goal: 0.25,
  diet: 0.15,
  calories: 0.1,
  time: 0.1,
});

export const RECIPE_SCORING_TARGETS = Object.freeze({
  balancedProteinGrams: 20,
  balancedFiberGrams: 8,
  balancedCalories: Object.freeze({ minimum: 250, maximum: 650 }),
  highProteinGrams: 30,
  highFiberGrams: 10,
  lowerCalorie: Object.freeze({ fullScoreAtOrBelow: 300, zeroScoreAtOrAbove: 600 }),
});

export const BUNDLED_RECIPE_LIMITS = Object.freeze({
  maximumAdditionalIngredients: 8,
  portionCaps: Object.freeze({
    grams: 400,
    kilograms: 0.4,
    milliliters: 400,
    liters: 0.4,
    teaspoon: 4,
    tablespoon: 4,
    cup: 2,
    piece: 4,
    serving: 2,
  }),
});

export const RECIPE_RUNTIME = Object.freeze({
  providerTimeoutMs: 5_000,
  geminiMaximumOutputTokens: 6_144,
  geminiMaximumResponseBytes: 96 * 1_024,
  geminiRetryAttempts: 2,
  rateLimitWindowMs: 15 * 60 * 1_000,
  rateLimitMaximum: 30,
  imageMaximumBytes: 3 * 1_024 * 1_024,
  imagePromptMaximumCharacters: 2_000,
});
