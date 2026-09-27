import { createHash } from 'node:crypto';

import { env } from '../config/env.js';
import { openFoodFactsProvider } from '../providers/foods/openFoodFactsProvider.js';
import { assertFoodProvider, parseProviderFoodId } from '../providers/foods/foodProvider.js';
import { usdaFoodProvider } from '../providers/foods/usdaFoodProvider.js';
import { AppError } from '../utils/AppError.js';

const NUTRIENT_PRECISION = Object.freeze({
  calories: 1,
  protein: 2,
  carbohydrates: 2,
  fat: 2,
  fiber: 2,
});

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const FOOD_CACHE_TTL_MS = 60 * 60 * 1000;
const searchCache = new Map();
const foodCache = new Map();

function configuredProviders() {
  return [usdaFoodProvider, openFoodFactsProvider].filter(
    (provider) => provider.configured !== false,
  );
}

function roundTo(value, decimalPlaces) {
  return Number(value.toFixed(decimalPlaces));
}

function normalizeSearchValue(value) {
  return value.trim().toLocaleLowerCase('en-US');
}

function cacheValue(cache, key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function readCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function withTimeout(signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.foodProviderTimeoutMs);

  function forwardAbort() {
    controller.abort(signal.reason);
  }
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', forwardAbort);
    },
  };
}

function publicUnit(unit) {
  const { unit: value, label, defaultQuantity, step, min, max } = unit;
  return { unit: value, label, defaultQuantity, step, min, max };
}

function internalUnit(unit) {
  return {
    unit: unit.unit,
    label: unit.label,
    referenceQuantityPerUnit: unit.referenceQuantityPerUnit,
    defaultQuantity: unit.defaultQuantity,
    step: unit.step,
    min: unit.min,
    max: unit.max,
  };
}

export function roundNutritionForResponse(nutrition) {
  return Object.fromEntries(
    Object.entries(NUTRIENT_PRECISION).map(([nutrient, precision]) => [
      nutrient,
      roundTo(Number(nutrition[nutrient] || 0), precision),
    ]),
  );
}

export function roundNutrientValue(nutrient, value) {
  const precision = NUTRIENT_PRECISION[nutrient];
  if (precision === undefined) throw new Error(`Unsupported nutrient: ${nutrient}.`);
  return roundTo(value, precision);
}

export function serializeCatalogFood(food) {
  return {
    id: food.id,
    name: food.name,
    description: food.description,
    category: food.category,
    imageUrl: food.imageUrl || null,
    baseServing: { ...food.baseServing },
    supportedUnits: food.supportedUnits.map(publicUnit),
    nutritionPerBaseServing: roundNutritionForResponse(food.nutrition),
    missingNutrients: [...(food.missingNutrients || [])],
    source: { ...food.source },
  };
}

export function createCatalogSnapshot(food) {
  return {
    id: food.id,
    name: food.name,
    description: food.description,
    category: food.category,
    imageUrl: food.imageUrl || null,
    baseServing: { ...food.baseServing },
    supportedUnits: food.supportedUnits.map(internalUnit),
    nutrition: { ...food.nutrition },
    missingNutrients: [...(food.missingNutrients || [])],
    source: { ...food.source },
  };
}

export function catalogFoodFromSnapshot(snapshot) {
  return {
    id: snapshot.id,
    name: snapshot.name,
    description: snapshot.description,
    category: snapshot.category,
    imageUrl: snapshot.imageUrl || null,
    baseServing: { ...snapshot.baseServing },
    supportedUnits: snapshot.supportedUnits.map(internalUnit),
    nutrition: { ...snapshot.nutrition },
    missingNutrients: [...(snapshot.missingNutrients || [])],
    source: { ...snapshot.source },
  };
}

function interleave(providerResults, limit) {
  const combined = [];
  const seen = new Set();
  let index = 0;
  while (combined.length < limit && providerResults.some((foods) => index < foods.length)) {
    for (const foods of providerResults) {
      const food = foods[index];
      if (!food || seen.has(food.id)) continue;
      seen.add(food.id);
      combined.push(food);
      if (combined.length === limit) break;
    }
    index += 1;
  }
  return combined;
}

export async function searchCatalogFoods(
  { search = '', limit = 10, signal } = {},
  { providers = configuredProviders() } = {},
) {
  const normalizedSearch = normalizeSearchValue(search);
  if (normalizedSearch.length < 2) {
    return { foods: [], providers: [], unavailableProviders: [] };
  }

  const activeProviders = providers.map(assertFoodProvider);
  const cacheKey = `${normalizedSearch}:${limit}:${activeProviders.map((provider) => provider.name).join(',')}`;
  const cached = readCache(searchCache, cacheKey);
  if (cached) return cached;

  const deadline = withTimeout(signal);
  try {
    const settlements = await Promise.allSettled(
      activeProviders.map((provider) =>
        provider.searchFoods(normalizedSearch, { limit, signal: deadline.signal }),
      ),
    );
    const successful = settlements
      .map((settlement, index) => ({ settlement, provider: activeProviders[index] }))
      .filter(({ settlement }) => settlement.status === 'fulfilled');

    if (successful.length === 0) {
      throw new AppError(
        503,
        'FOOD_SEARCH_UNAVAILABLE',
        'Food search is temporarily unavailable. You can still add a custom food.',
      );
    }

    const providerResults = successful.map(({ settlement }) => settlement.value);
    for (const foods of providerResults) {
      for (const food of foods) cacheValue(foodCache, food.id, food, FOOD_CACHE_TTL_MS);
    }

    return cacheValue(
      searchCache,
      cacheKey,
      {
        foods: interleave(providerResults, limit).map(serializeCatalogFood),
        providers: successful.map(({ provider }) => provider.name),
        unavailableProviders: settlements
          .map((settlement, index) => ({ settlement, provider: activeProviders[index] }))
          .filter(({ settlement }) => settlement.status === 'rejected')
          .map(({ provider }) => provider.name),
      },
      SEARCH_CACHE_TTL_MS,
    );
  } finally {
    deadline.dispose();
  }
}

export async function getCatalogFoodInternal(
  foodId,
  { providers = configuredProviders(), signal } = {},
) {
  const cached = readCache(foodCache, foodId);
  if (cached) return cached;

  const parsed = parseProviderFoodId(foodId);
  const provider = providers
    .map(assertFoodProvider)
    .find((candidate) => candidate.name === parsed.provider);
  if (!provider) {
    throw new AppError(
      503,
      'FOOD_PROVIDER_NOT_CONFIGURED',
      'The selected food provider is not configured on the server.',
    );
  }

  const deadline = withTimeout(signal);
  try {
    const food = await provider.getFood(parsed.externalId, { signal: deadline.signal });
    if (!food) {
      throw new AppError(404, 'FOOD_NOT_FOUND', 'The requested food was not found.');
    }
    return cacheValue(foodCache, food.id, food, FOOD_CACHE_TTL_MS);
  } finally {
    deadline.dispose();
  }
}

export async function getCatalogFood(foodId, options) {
  return serializeCatalogFood(await getCatalogFoodInternal(foodId, options));
}

export function createCustomCatalogFood({ customFood, quantity, unit }) {
  const fingerprint = JSON.stringify({
    name: customFood.name.trim().toLocaleLowerCase('en-US'),
    quantity,
    unit,
    nutrition: customFood.nutrition,
  });
  const id = `custom-${createHash('sha256').update(fingerprint).digest('hex').slice(0, 20)}`;
  const label = unit === 'piece' ? 'pieces' : unit === 'serving' ? 'servings' : unit;

  return {
    id,
    name: customFood.name.trim(),
    description: customFood.description?.trim() || 'Nutrition entered manually',
    category: 'custom food',
    imageUrl: null,
    baseServing: { quantity, unit },
    supportedUnits: [
      {
        unit,
        label,
        referenceQuantityPerUnit: 1,
        defaultQuantity: quantity,
        step: unit === 'grams' || unit === 'milliliters' ? 1 : 0.25,
        min: 0.01,
        max: 100_000,
      },
    ],
    nutrition: { ...customFood.nutrition },
    missingNutrients: [],
    source: {
      provider: 'custom',
      label: 'User-entered nutrition',
      externalId: id,
      dataType: 'custom food',
      license: 'user supplied',
    },
  };
}

export function calculateNutritionSnapshotFromFood({ food, quantity, unit }) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be greater than 0.');
  }

  const unitDefinition = food.supportedUnits.find((candidate) => candidate.unit === unit);
  if (!unitDefinition) {
    throw new AppError(400, 'UNSUPPORTED_FOOD_UNIT', `${food.name} cannot be measured in ${unit}.`);
  }

  if (quantity < unitDefinition.min || quantity > unitDefinition.max) {
    throw new AppError(
      400,
      'INVALID_QUANTITY',
      `Quantity for ${unitDefinition.label} must be between ${unitDefinition.min} and ${unitDefinition.max}.`,
    );
  }

  const referenceQuantity = quantity * unitDefinition.referenceQuantityPerUnit;
  const scale = referenceQuantity / food.baseServing.quantity;
  const nutrition = Object.fromEntries(
    Object.keys(NUTRIENT_PRECISION).map((nutrient) => [nutrient, food.nutrition[nutrient] * scale]),
  );
  if (Object.values(nutrition).some((value) => !Number.isFinite(value) || value > 1_000_000)) {
    throw new AppError(
      400,
      'NUTRITION_VALUE_TOO_LARGE',
      'The selected quantity produces nutrition values that are too large to save.',
    );
  }

  return {
    foodId: food.id,
    foodName: food.name,
    quantity,
    unit,
    equivalentBaseQuantity: referenceQuantity,
    baseUnit: food.baseServing.unit,
    nutrition,
    missingNutrients: [...(food.missingNutrients || [])],
    source: { ...food.source },
    catalogSnapshot: createCatalogSnapshot(food),
  };
}

export async function calculateNutritionSnapshot(
  { foodId, quantity, unit, food, signal },
  options,
) {
  const resolvedFood = food || (await getCatalogFoodInternal(foodId, { signal, ...options }));
  return calculateNutritionSnapshotFromFood({ food: resolvedFood, quantity, unit });
}

export function getNutritionPreviewFromFood(selection) {
  const snapshot = calculateNutritionSnapshotFromFood(selection);
  return {
    ...snapshot,
    catalogSnapshot: undefined,
    equivalentBaseQuantity: roundTo(snapshot.equivalentBaseQuantity, 3),
    nutrition: roundNutritionForResponse(snapshot.nutrition),
  };
}

export async function getNutritionPreview(selection, options) {
  const snapshot = await calculateNutritionSnapshot(selection, options);
  return {
    ...snapshot,
    catalogSnapshot: undefined,
    equivalentBaseQuantity: roundTo(snapshot.equivalentBaseQuantity, 3),
    nutrition: roundNutritionForResponse(snapshot.nutrition),
  };
}

export function getCustomNutritionPreview({ customFood, quantity, unit }) {
  const food = createCustomCatalogFood({ customFood, quantity, unit });
  return getNutritionPreviewFromFood({ food, quantity, unit });
}

export function clearFoodCatalogCachesForTests() {
  searchCache.clear();
  foodCache.clear();
}
