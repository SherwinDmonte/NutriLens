import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { createProviderFoodId, providerRequestError } from './foodProvider.js';
import {
  boundedLabel,
  cleanLabel,
  createMassUnits,
  finiteNonNegative,
  firstNonEmpty,
  humanizeTag,
  normalizeNutrition,
} from './foodProviderUtils.js';

const API_BASE_URL = 'https://world.openfoodfacts.org';
const SEARCH_API_URL = 'https://search.openfoodfacts.org/search';
const SEARCH_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'categories',
  'categories_tags',
  'quantity',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'product_quantity_unit',
  'image_front_small_url',
  'image_small_url',
  'nutriments',
].join(',');

function escapeLuceneText(value) {
  return value.replace(/([+\-=&|><!(){}[\]^"~*?:\\/])/g, '\\$1');
}

function createSearchQuery(query, countryFilter) {
  const textQuery = escapeLuceneText(query);
  if (!countryFilter) return textQuery;
  const countryTag = countryFilter.trim().replace(/\s+/g, '-');
  return `${textQuery} countries_tags:"en:${countryTag}"`;
}

function trustedProductImageUrl(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    try {
      const url = new URL(candidate.trim());
      if (url.protocol === 'https:' && url.hostname === 'images.openfoodfacts.org') {
        return url.href;
      }
    } catch {
      // Ignore malformed provider values and continue to the next candidate.
    }
  }
  return null;
}

function extractCalories(nutriments) {
  const kcal = finiteNonNegative(nutriments?.['energy-kcal_100g']);
  if (kcal !== null) return kcal;
  const kilojoules = finiteNonNegative(nutriments?.energy_100g);
  return kilojoules === null ? null : kilojoules / 4.184;
}

function inferBaseUnit(product) {
  const units = [product.serving_quantity_unit, product.product_quantity_unit]
    .map((value) => cleanLabel(value).toLocaleLowerCase('en-US'))
    .filter(Boolean);
  return units.some((unit) => ['ml', 'milliliter', 'milliliters'].includes(unit))
    ? 'milliliters'
    : 'grams';
}

export function mapOpenFoodFactsProduct(product) {
  const externalId = String(product.code || '');
  if (!/^\d{4,18}$/.test(externalId)) return null;

  const name = boundedLabel(
    firstNonEmpty(product.product_name, product.product_name_en, product.generic_name),
    120,
  );
  if (!name) return null;

  const { nutrition, missingNutrients } = normalizeNutrition({
    calories: extractCalories(product.nutriments),
    protein: product.nutriments?.proteins_100g,
    carbohydrates: product.nutriments?.carbohydrates_100g,
    fat: product.nutriments?.fat_100g,
    fiber: product.nutriments?.fiber_100g,
  });
  if (missingNutrients.includes('calories')) return null;

  const baseUnit = inferBaseUnit(product);
  const servingQuantity = finiteNonNegative(product.serving_quantity);
  const servingUnit = cleanLabel(product.serving_quantity_unit).toLocaleLowerCase('en-US');
  const compatibleServing =
    servingQuantity &&
    ((baseUnit === 'grams' && ['g', 'gram', 'grams'].includes(servingUnit)) ||
      (baseUnit === 'milliliters' && ['ml', 'milliliter', 'milliliters'].includes(servingUnit)));
  const category = boundedLabel(
    humanizeTag(product.categories_tags?.[0] || product.categories),
    120,
  );
  const brands = Array.isArray(product.brands) ? product.brands.join(', ') : product.brands;
  const brand = boundedLabel(brands, 100);
  const description =
    boundedLabel([brand, cleanLabel(product.quantity)].filter(Boolean).join(' · '), 240) ||
    category;

  return {
    id: createProviderFoodId('open_food_facts', externalId),
    name,
    description,
    category,
    imageUrl: trustedProductImageUrl(product.image_front_small_url, product.image_small_url),
    baseServing: { quantity: 100, unit: baseUnit },
    supportedUnits: createMassUnits({
      baseUnit,
      servingQuantity: compatibleServing ? servingQuantity : undefined,
      servingLabel: compatibleServing ? boundedLabel(product.serving_size, 60) : undefined,
    }),
    nutrition,
    missingNutrients,
    source: {
      provider: 'open_food_facts',
      label: 'Open Food Facts',
      externalId,
      dataType: 'packaged food',
      license: 'ODbL',
    },
  };
}

function responseError(response) {
  if (response.status === 429) {
    return new AppError(
      429,
      'FOOD_PROVIDER_RATE_LIMITED',
      'Open Food Facts is receiving too many requests. Please try again shortly.',
    );
  }
  return new AppError(
    503,
    'FOOD_PROVIDER_UNAVAILABLE',
    'Open Food Facts is temporarily unavailable. Please try again.',
  );
}

export function createOpenFoodFactsProvider({
  country = env.openFoodFactsCountry,
  userAgent = env.openFoodFactsUserAgent,
  fetchImpl = fetch,
} = {}) {
  const headers = { 'User-Agent': userAgent, Accept: 'application/json' };

  return {
    name: 'open_food_facts',
    label: 'Open Food Facts',
    configured: true,

    async searchFoods(query, { limit = 10, signal } = {}) {
      try {
        async function search(countryFilter) {
          const response = await fetchImpl(SEARCH_API_URL, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              q: createSearchQuery(query, countryFilter),
              fields: SEARCH_FIELDS.split(','),
              page: 1,
              page_size: Math.min(limit, 20),
              langs: ['en'],
              boost_phrase: true,
            }),
            signal,
          });
          if (!response.ok) throw responseError(response);
          const payload = await response.json();
          return (Array.isArray(payload.hits) ? payload.hits : [])
            .map(mapOpenFoodFactsProduct)
            .filter(Boolean)
            .slice(0, limit);
        }

        const countryFilter = country === 'global' ? '' : country;
        const localResults = await search(countryFilter);
        if (localResults.length > 0 || !countryFilter) return localResults;
        return search('');
      } catch (error) {
        throw providerRequestError('Open Food Facts', error);
      }
    },

    async getFood(externalId, { signal } = {}) {
      const parameters = new URLSearchParams({ fields: SEARCH_FIELDS });
      try {
        const response = await fetchImpl(
          `${API_BASE_URL}/api/v2/product/${externalId}.json?${parameters}`,
          { headers, signal },
        );
        if (response.status === 404) {
          throw new AppError(
            404,
            'FOOD_NOT_FOUND',
            'The requested Open Food Facts product was not found.',
          );
        }
        if (!response.ok) throw responseError(response);
        const payload = await response.json();
        if (payload.status === 0) {
          throw new AppError(
            404,
            'FOOD_NOT_FOUND',
            'The requested Open Food Facts product was not found.',
          );
        }
        const food = mapOpenFoodFactsProduct(payload.product);
        if (!food) {
          throw new AppError(
            422,
            'FOOD_NUTRITION_INCOMPLETE',
            'This packaged food does not contain enough nutrition information to log.',
          );
        }
        return food;
      } catch (error) {
        throw providerRequestError('Open Food Facts', error);
      }
    },
  };
}

export const openFoodFactsProvider = createOpenFoodFactsProvider();
