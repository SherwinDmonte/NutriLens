const CORE_NUTRIENTS = Object.freeze(['calories', 'protein', 'carbohydrates', 'fat', 'fiber']);

const NUTRIENT_LIMITS = Object.freeze({
  calories: 100_000,
  protein: 10_000,
  carbohydrates: 10_000,
  fat: 10_000,
  fiber: 10_000,
});

export function finiteNonNegative(value) {
  const numericValue = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
}

export function normalizeNutrition(values) {
  const missingNutrients = [];
  const nutrition = Object.fromEntries(
    CORE_NUTRIENTS.map((nutrient) => {
      const value = finiteNonNegative(values[nutrient]);
      const isValid = value !== null && value <= NUTRIENT_LIMITS[nutrient];
      if (!isValid) missingNutrients.push(nutrient);
      return [nutrient, isValid ? value : 0];
    }),
  );
  return { nutrition, missingNutrients };
}

export function createMassUnits({ baseUnit = 'grams', servingQuantity, servingLabel } = {}) {
  const isVolume = baseUnit === 'milliliters';
  const units = [
    {
      unit: baseUnit,
      label: baseUnit,
      referenceQuantityPerUnit: 1,
      defaultQuantity: 100,
      step: 1,
      min: 1,
      max: 5000,
    },
  ];

  const normalizedServing = finiteNonNegative(servingQuantity);
  if (normalizedServing && normalizedServing > 0) {
    units.push({
      unit: 'serving',
      label: servingLabel ? `servings (${servingLabel})` : 'servings',
      referenceQuantityPerUnit: normalizedServing,
      defaultQuantity: 1,
      step: 0.25,
      min: 0.25,
      max: 50,
    });
  }

  if (!isVolume) return units;
  return units;
}

export function cleanLabel(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.replace(/\s+/g, ' ').trim() || fallback;
}

export function boundedLabel(value, maximumLength, fallback = '') {
  return cleanLabel(value, fallback).slice(0, maximumLength);
}

export function firstNonEmpty(...values) {
  return values.map((value) => cleanLabel(value)).find(Boolean) || '';
}

export function humanizeTag(value, fallback = 'packaged food') {
  const normalized = cleanLabel(value)
    .replace(/^[a-z]{2}:/i, '')
    .replace(/-/g, ' ');
  return normalized || fallback;
}
