const unitLabels = Object.freeze({
  grams: Object.freeze({ singular: 'g', plural: 'g' }),
  kilograms: Object.freeze({ singular: 'kg', plural: 'kg' }),
  milliliters: Object.freeze({ singular: 'ml', plural: 'ml' }),
  liters: Object.freeze({ singular: 'l', plural: 'l' }),
  teaspoon: Object.freeze({ singular: 'tsp', plural: 'tsp' }),
  tablespoon: Object.freeze({ singular: 'tbsp', plural: 'tbsp' }),
  cup: Object.freeze({ singular: 'cup', plural: 'cups' }),
  piece: Object.freeze({ singular: 'piece', plural: 'pieces' }),
  serving: Object.freeze({ singular: 'serving', plural: 'servings' }),
});

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export const RECIPE_NUTRITION_METRICS = Object.freeze([
  Object.freeze({ key: 'calories', label: 'Calories', unit: 'kcal' }),
  Object.freeze({ key: 'protein', label: 'Protein', unit: 'g' }),
  Object.freeze({ key: 'carbohydrates', label: 'Carbs', unit: 'g' }),
  Object.freeze({ key: 'fat', label: 'Fat', unit: 'g' }),
  Object.freeze({ key: 'fiber', label: 'Fiber', unit: 'g' }),
]);

export const RECIPE_SCORE_COMPONENTS = Object.freeze([
  Object.freeze({ key: 'ingredient', label: 'Ingredient fit', weight: '40%' }),
  Object.freeze({ key: 'goal', label: 'Goal fit', weight: '25%' }),
  Object.freeze({ key: 'diet', label: 'Dietary fit', weight: '15%' }),
  Object.freeze({ key: 'calories', label: 'Calorie fit', weight: '10%' }),
  Object.freeze({ key: 'time', label: 'Time fit', weight: '10%' }),
]);

export function humanizeRecipeValue(value) {
  if (!value) return '';
  return value
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function formatRecipeIngredientAmount(ingredient) {
  if (ingredient.quantity === null || ingredient.quantity === undefined) return 'Amount as needed';
  const quantity = numberFormatter.format(ingredient.quantity);
  if (!ingredient.unit) return quantity;
  const labels = unitLabels[ingredient.unit];
  if (!labels) return `${quantity} ${ingredient.unit}`;
  return `${quantity} ${ingredient.quantity === 1 ? labels.singular : labels.plural}`;
}

export function formatRecipeNutritionValue(value) {
  if (!Number.isFinite(value)) return 'Not available';
  return numberFormatter.format(value);
}

export function getRecipeProviderLabel(provider) {
  if (provider === 'bundled') return 'Bundled provider';
  if (provider === 'gemini') return 'Gemini provider';
  return humanizeRecipeValue(provider) || 'Recipe provider';
}

export function getFallbackReasonLabel(reason) {
  const labels = {
    missing_configuration: 'Gemini was not configured',
    rate_limited: 'Gemini rate limit reached',
    quota_exhausted: 'Gemini free quota exhausted',
    timeout: 'Gemini timed out',
    unavailable: 'Gemini was unavailable',
    safety_refusal: 'Gemini declined the request',
    invalid_output: 'Gemini returned unusable data',
  };
  return labels[reason] || 'The primary provider was unavailable';
}
