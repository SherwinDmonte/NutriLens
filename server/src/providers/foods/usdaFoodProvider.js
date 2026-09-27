import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { createProviderFoodId, providerRequestError } from './foodProvider.js';
import {
  boundedLabel,
  cleanLabel,
  createMassUnits,
  finiteNonNegative,
  normalizeNutrition,
} from './foodProviderUtils.js';

const API_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const DATA_TYPES = Object.freeze(['Foundation', 'Survey (FNDDS)', 'SR Legacy', 'Branded']);

const NUTRIENT_MATCHERS = Object.freeze({
  calories: (name, unit) => name === 'energy' && unit.toLowerCase() === 'kcal',
  protein: (name) => name === 'protein',
  carbohydrates: (name) => name === 'carbohydrate, by difference',
  fat: (name) => name === 'total lipid (fat)',
  fiber: (name) => name === 'fiber, total dietary',
});

function foodNutrientName(item) {
  return cleanLabel(item?.nutrientName || item?.nutrient?.name).toLocaleLowerCase('en-US');
}

function foodNutrientUnit(item) {
  return cleanLabel(item?.unitName || item?.nutrient?.unitName);
}

function foodNutrientValue(item) {
  return finiteNonNegative(item?.value ?? item?.amount);
}

function extractNutrition(foodNutrients = []) {
  const values = {};
  for (const [key, matcher] of Object.entries(NUTRIENT_MATCHERS)) {
    const match = foodNutrients.find((item) =>
      matcher(foodNutrientName(item), foodNutrientUnit(item)),
    );
    values[key] = match ? foodNutrientValue(match) : null;
  }
  return normalizeNutrition(values);
}

function servingDefinition(food) {
  const brandedServing = finiteNonNegative(food.servingSize);
  if (brandedServing && /^(g|gram|grams)$/i.test(cleanLabel(food.servingSizeUnit))) {
    return {
      servingQuantity: brandedServing,
      servingLabel: boundedLabel(food.householdServingFullText, 60) || `${brandedServing} g`,
    };
  }

  const portion = food.foodPortions?.find(
    (candidate) => finiteNonNegative(candidate.gramWeight) > 0,
  );
  if (!portion) return {};
  return {
    servingQuantity: portion.gramWeight,
    servingLabel:
      boundedLabel(portion.portionDescription || portion.modifier, 60) || `${portion.gramWeight} g`,
  };
}

export function mapUsdaFood(food) {
  const externalId = String(food.fdcId || '');
  if (!/^\d+$/.test(externalId)) return null;

  const name = boundedLabel(food.description, 120);
  if (!name) return null;

  const { nutrition, missingNutrients } = extractNutrition(food.foodNutrients);
  if (missingNutrients.includes('calories')) return null;

  const brand = boundedLabel(food.brandName || food.brandOwner, 100);
  const dataType = boundedLabel(food.dataType, 80, 'USDA food');
  const serving = servingDefinition(food);

  return {
    id: createProviderFoodId('usda', externalId),
    name,
    description: boundedLabel([brand, dataType].filter(Boolean).join(' · '), 240),
    category: boundedLabel(food.foodCategory, 120, dataType),
    baseServing: { quantity: 100, unit: 'grams' },
    supportedUnits: createMassUnits(serving),
    nutrition,
    missingNutrients,
    source: {
      provider: 'usda',
      label: 'USDA FoodData Central',
      externalId,
      dataType,
      license: 'CC0 1.0',
    },
  };
}

function responseError(response) {
  if (response.status === 429) {
    return new AppError(
      429,
      'FOOD_PROVIDER_RATE_LIMITED',
      'USDA FoodData Central is receiving too many requests. Please try again shortly.',
    );
  }
  return new AppError(
    503,
    'FOOD_PROVIDER_UNAVAILABLE',
    'USDA FoodData Central is temporarily unavailable. Please try again.',
  );
}

export function createUsdaFoodProvider({ apiKey = env.usdaFdcApiKey, fetchImpl = fetch } = {}) {
  return {
    name: 'usda',
    label: 'USDA FoodData Central',
    configured: Boolean(apiKey),

    async searchFoods(query, { limit = 10, signal } = {}) {
      if (!apiKey) return [];
      try {
        const response = await fetchImpl(
          `${API_BASE_URL}/foods/search?api_key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, pageSize: Math.min(limit, 25), dataType: DATA_TYPES }),
            signal,
          },
        );
        if (!response.ok) throw responseError(response);
        const payload = await response.json();
        return (Array.isArray(payload.foods) ? payload.foods : [])
          .map(mapUsdaFood)
          .filter(Boolean)
          .slice(0, limit);
      } catch (error) {
        throw providerRequestError('USDA FoodData Central', error);
      }
    },

    async getFood(externalId, { signal } = {}) {
      if (!apiKey) {
        throw new AppError(
          503,
          'FOOD_PROVIDER_NOT_CONFIGURED',
          'USDA FoodData Central is not configured on the server.',
        );
      }
      try {
        const response = await fetchImpl(
          `${API_BASE_URL}/food/${externalId}?api_key=${encodeURIComponent(apiKey)}`,
          { signal },
        );
        if (response.status === 404) {
          throw new AppError(404, 'FOOD_NOT_FOUND', 'The requested USDA food was not found.');
        }
        if (!response.ok) throw responseError(response);
        const food = mapUsdaFood(await response.json());
        if (!food) {
          throw new AppError(
            422,
            'FOOD_NUTRITION_INCOMPLETE',
            'This USDA food does not contain enough nutrition information to log.',
          );
        }
        return food;
      } catch (error) {
        throw providerRequestError('USDA FoodData Central', error);
      }
    },
  };
}

export const usdaFoodProvider = createUsdaFoodProvider();
