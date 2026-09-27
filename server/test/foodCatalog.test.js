import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import {
  createOpenFoodFactsProvider,
  mapOpenFoodFactsProduct,
} from '../src/providers/foods/openFoodFactsProvider.js';
import { mapUsdaFood } from '../src/providers/foods/usdaFoodProvider.js';
import { createFoodCatalogRouter } from '../src/routes/foodCatalogRoutes.js';
import {
  calculateNutritionSnapshotFromFood,
  clearFoodCatalogCachesForTests,
  createCustomCatalogFood,
  getCustomNutritionPreview,
  getNutritionPreviewFromFood,
  searchCatalogFoods,
  serializeCatalogFood,
} from '../src/services/foodCatalogService.js';

function foodFixture(overrides = {}) {
  return {
    id: 'usda-123',
    name: 'Cooked rice',
    description: 'Foundation food',
    category: 'grains',
    baseServing: { quantity: 100, unit: 'grams' },
    supportedUnits: [
      {
        unit: 'grams',
        label: 'grams',
        referenceQuantityPerUnit: 1,
        defaultQuantity: 100,
        step: 1,
        min: 1,
        max: 5000,
      },
      {
        unit: 'serving',
        label: 'servings (150 g)',
        referenceQuantityPerUnit: 150,
        defaultQuantity: 1,
        step: 0.25,
        min: 0.25,
        max: 50,
      },
    ],
    nutrition: { calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3, fiber: 0.4 },
    missingNutrients: [],
    source: {
      provider: 'usda',
      label: 'USDA FoodData Central',
      externalId: '123',
      dataType: 'Foundation',
      license: 'CC0 1.0',
    },
    ...overrides,
  };
}

function createProvider(name, foods, { fail = false } = {}) {
  return {
    name,
    configured: true,
    async searchFoods() {
      if (fail) throw new Error('provider unavailable');
      return foods;
    },
    async getFood(externalId) {
      if (fail) throw new Error('provider unavailable');
      return foods.find((food) => food.source.externalId === externalId) || null;
    },
  };
}

function createCatalogTestApp(service) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/foods',
    createFoodCatalogRouter({
      authenticate: (_request, _response, next) => next(),
      service,
    }),
  );
  app.use(errorHandler);
  return app;
}

test('USDA records normalize source, serving, and core nutrition', () => {
  const food = mapUsdaFood({
    fdcId: 234,
    description: 'Lentils, cooked',
    dataType: 'Foundation',
    foodCategory: 'Legumes',
    foodPortions: [{ gramWeight: 180, portionDescription: '1 cup' }],
    foodNutrients: [
      { nutrientName: 'Energy', unitName: 'KCAL', value: 116 },
      { nutrientName: 'Protein', unitName: 'G', value: 9 },
      { nutrientName: 'Carbohydrate, by difference', unitName: 'G', value: 20 },
      { nutrientName: 'Total lipid (fat)', unitName: 'G', value: 0.4 },
      { nutrientName: 'Fiber, total dietary', unitName: 'G', value: 7.9 },
    ],
  });

  assert.equal(food.id, 'usda-234');
  assert.equal(food.source.provider, 'usda');
  assert.equal(food.supportedUnits[1].referenceQuantityPerUnit, 180);
  assert.deepEqual(food.missingNutrients, []);
});

test('Open Food Facts records normalize Indian packaged-food nutrition and provenance', () => {
  const food = mapOpenFoodFactsProduct({
    code: '8901234567890',
    product_name: 'Masala oats',
    brands: 'Example Foods',
    quantity: '500 g',
    categories_tags: ['en:oatmeal'],
    serving_size: '40 g',
    serving_quantity: 40,
    serving_quantity_unit: 'g',
    image_front_small_url:
      'https://images.openfoodfacts.org/images/products/890/123/456/7890/front_en.3.200.jpg',
    nutriments: {
      'energy-kcal_100g': 380,
      proteins_100g: 12,
      carbohydrates_100g: 65,
      fat_100g: 8,
      fiber_100g: 10,
    },
  });

  assert.equal(food.id, 'off-8901234567890');
  assert.equal(food.source.provider, 'open_food_facts');
  assert.equal(
    food.imageUrl,
    'https://images.openfoodfacts.org/images/products/890/123/456/7890/front_en.3.200.jpg',
  );
  assert.equal(food.description, 'Example Foods · 500 g');
  assert.equal(food.supportedUnits[1].referenceQuantityPerUnit, 40);
});

test('Open Food Facts ignores untrusted product-image hosts', () => {
  const food = mapOpenFoodFactsProduct({
    code: '8901234567890',
    product_name: 'Masala oats',
    image_front_small_url: 'https://tracking.example/food.jpg',
    nutriments: {
      'energy-kcal_100g': 380,
      proteins_100g: 12,
      carbohydrates_100g: 65,
      fat_100g: 8,
      fiber_100g: 10,
    },
  });

  assert.equal(food.imageUrl, null);
});

test('Open Food Facts detail reads use the nutrition-compatible product endpoint', async () => {
  let requestedUrl;
  const provider = createOpenFoodFactsProvider({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            status: 1,
            product: {
              code: '8901234567890',
              product_name: 'Masala oats',
              nutriments: {
                'energy-kcal_100g': 380,
                proteins_100g: 12,
                carbohydrates_100g: 65,
                fat_100g: 8,
                fiber_100g: 10,
              },
            },
          };
        },
      };
    },
  });

  const food = await provider.getFood('8901234567890');

  assert.match(requestedUrl, /\/api\/v2\/product\/8901234567890\.json/);
  assert.match(requestedUrl, /image_front_small_url/);
  assert.equal(food.nutrition.calories, 380);
});

test('Open Food Facts searches India first and falls back to global packaged foods', async () => {
  const requests = [];
  const product = {
    code: '3017620422003',
    product_name: 'Hazelnut spread',
    brands: ['Example Foods'],
    nutriments: {
      'energy-kcal_100g': 539,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
      fiber_100g: 0,
    },
  };
  const provider = createOpenFoodFactsProvider({
    country: 'india',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { hits: requests.length === 1 ? [] : [product] };
        },
      };
    },
  });

  const foods = await provider.searchFoods('hazelnut', { limit: 5 });

  assert.equal(foods[0].id, 'off-3017620422003');
  assert.equal(foods[0].description, 'Example Foods');
  assert.equal(requests[0].url, 'https://search.openfoodfacts.org/search');
  assert.equal(requests[0].options.method, 'POST');
  const indiaRequest = JSON.parse(requests[0].options.body);
  const globalRequest = JSON.parse(requests[1].options.body);
  assert.equal(indiaRequest.q, 'hazelnut countries_tags:"en:india"');
  assert.equal(globalRequest.q, 'hazelnut');
  assert.equal(indiaRequest.page_size, 5);
  assert.ok(indiaRequest.fields.includes('image_front_small_url'));
});

test('hybrid search interleaves providers and survives one unavailable provider', async () => {
  clearFoodCatalogCachesForTests();
  const usdaFood = foodFixture();
  const offFood = foodFixture({
    id: 'off-8901',
    name: 'Packaged rice',
    source: {
      provider: 'open_food_facts',
      label: 'Open Food Facts',
      externalId: '8901',
      dataType: 'packaged food',
      license: 'ODbL',
    },
  });
  const result = await searchCatalogFoods(
    { search: 'rice', limit: 5 },
    {
      providers: [createProvider('usda', [usdaFood]), createProvider('open_food_facts', [offFood])],
    },
  );

  assert.deepEqual(
    result.foods.map((food) => food.id),
    ['usda-123', 'off-8901'],
  );
  assert.deepEqual(result.providers, ['usda', 'open_food_facts']);

  clearFoodCatalogCachesForTests();
  const fallback = await searchCatalogFoods(
    { search: 'rice', limit: 5 },
    {
      providers: [
        createProvider('usda', [usdaFood]),
        createProvider('open_food_facts', [], { fail: true }),
      ],
    },
  );
  assert.deepEqual(fallback.providers, ['usda']);
  assert.deepEqual(fallback.unavailableProviders, ['open_food_facts']);
});

test('nutrition scales deterministically and hides internal conversion weights', () => {
  const food = foodFixture();
  const grams = calculateNutritionSnapshotFromFood({ food, quantity: 200, unit: 'grams' });
  const serving = getNutritionPreviewFromFood({ food, quantity: 2, unit: 'serving' });

  assert.deepEqual(grams.nutrition, {
    calories: 260,
    protein: 5.4,
    carbohydrates: 56.4,
    fat: 0.6,
    fiber: 0.8,
  });
  assert.equal(serving.equivalentBaseQuantity, 300);
  assert.equal(serving.nutrition.calories, 390);
  assert.equal(serializeCatalogFood(food).supportedUnits[0].referenceQuantityPerUnit, undefined);
  assert.equal(serializeCatalogFood(food).imageUrl, null);
});

test('custom foods are source-labelled and preview the submitted nutrition exactly', () => {
  const input = {
    customFood: {
      name: 'Homemade poha',
      nutrition: {
        calories: 280,
        protein: 7,
        carbohydrates: 50,
        fat: 6,
        fiber: 5,
      },
    },
    quantity: 250,
    unit: 'grams',
  };
  const food = createCustomCatalogFood(input);
  const preview = getCustomNutritionPreview(input);

  assert.match(food.id, /^custom-[a-f0-9]{20}$/);
  assert.equal(food.source.provider, 'custom');
  assert.deepEqual(preview.nutrition, input.customFood.nutrition);
});

test('catalog routes expose hybrid metadata, detail, and custom previews', async () => {
  const food = foodFixture();
  const service = {
    searchCatalogFoods: async () => ({
      foods: [serializeCatalogFood(food)],
      providers: ['usda'],
      unavailableProviders: ['open_food_facts'],
    }),
    getCatalogFood: async () => serializeCatalogFood(food),
    getNutritionPreview: async (selection) =>
      getNutritionPreviewFromFood({ food, quantity: selection.quantity, unit: selection.unit }),
    getCustomNutritionPreview,
  };
  const app = createCatalogTestApp(service);

  const searchResponse = await request(app).get('/api/foods?search=rice&limit=5').expect(200);
  assert.equal(searchResponse.body.data.foods[0].source.provider, 'usda');
  assert.deepEqual(searchResponse.body.data.unavailableProviders, ['open_food_facts']);

  await request(app).get('/api/foods/usda-123').expect(200);
  const previewResponse = await request(app)
    .get('/api/foods/usda-123/nutrition?quantity=200&unit=grams')
    .expect(200);
  assert.equal(previewResponse.body.data.preview.nutrition.calories, 260);

  const customResponse = await request(app)
    .post('/api/foods/custom/nutrition')
    .send({
      customFood: {
        name: 'Upma',
        nutrition: { calories: 250, protein: 6, carbohydrates: 42, fat: 7, fiber: 4 },
      },
      quantity: 1,
      unit: 'serving',
    })
    .expect(200);
  assert.equal(customResponse.body.data.preview.source.provider, 'custom');
});

test('catalog endpoints require an authenticated session in the application', async () => {
  const response = await request(createApp()).get('/api/foods?search=rice').expect(401);
  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
});
