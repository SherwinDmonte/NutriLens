import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';

import { RECIPE_LIMITS, RECIPE_SCORING_WEIGHTS } from '../src/config/recipes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { validateBody } from '../src/middleware/validateRequest.js';
import {
  enrichedRecipeSchema,
  providerRecipeBatchSchema,
  recipeRecommendationRequestSchema,
  recipeRecommendationResponseSchema,
} from '../src/validators/recipeRecommendationValidators.js';
import {
  canConvertRecipeUnits,
  convertRecipeQuantity,
  getRecipeUnitDimension,
  normalizeRecipeUnit,
} from '../src/utils/recipeUnits.js';
import {
  calorieLimitedRequestFixture,
  eggetarianRequestFixture,
  emptyIngredientRequestFixture,
  enrichedRecipeFixture,
  highProteinRequestFixture,
  ingredientOnlyRequestFixture,
  providerRecipeFixture,
  recommendationResponseFixture,
  timeLimitedRequestFixture,
  veganRequestFixture,
  vegetarianRequestFixture,
} from '../test-support/recipeRecommendationFixtures.js';

function createRequestValidationApp(onValidRequest) {
  const app = express();
  app.use(express.json());
  app.post(
    '/recommend',
    validateBody(recipeRecommendationRequestSchema),
    (requestValue, response) => {
      onValidRequest(requestValue.validatedBody);
      response.status(200).json({ data: requestValue.validatedBody });
    },
  );
  app.use(errorHandler);
  return app;
}

test('recommendation requests normalize defaults, ingredient names, aliases, and duplicates', () => {
  const parsed = recipeRecommendationRequestSchema.parse({
    ingredients: [
      { name: '  Brown   Rice ', quantity: 100, unit: 'g' },
      { name: 'brown rice', quantity: 50, unit: 'grams' },
      { name: ' Tomato ' },
      { name: 'TOMATO' },
    ],
  });

  assert.deepEqual(parsed, {
    ingredients: [{ name: 'brown rice', quantity: 150, unit: 'grams' }, { name: 'tomato' }],
    dietaryPreference: 'none',
    goal: 'balanced',
    mealType: 'any',
    resultCount: 4,
  });
});

test('an explicit duplicate quantity is preserved when the other duplicate has no quantity', () => {
  const parsed = recipeRecommendationRequestSchema.parse({
    ingredients: [{ name: 'Spinach' }, { name: ' spinach ', quantity: 2, unit: 'cups' }],
  });

  assert.deepEqual(parsed.ingredients, [{ name: 'spinach', quantity: 2, unit: 'cup' }]);
});

test('duplicate ingredient quantities require one compatible canonical unit', () => {
  const result = recipeRecommendationRequestSchema.safeParse({
    ingredients: [
      { name: 'rice', quantity: 1, unit: 'cup' },
      { name: 'RICE', quantity: 100, unit: 'grams' },
    ],
  });

  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some(
      (issue) =>
        issue.path.join('.') === 'ingredients.1.unit' && issue.message.includes('same unit'),
    ),
    true,
  );
});

test('deduplication validates the cumulative quantity across every duplicate', () => {
  const result = recipeRecommendationRequestSchema.safeParse({
    ingredients: [
      { name: 'oats', quantity: 6_000, unit: 'grams' },
      { name: 'OATS', quantity: 3_000, unit: 'g' },
      { name: ' oats ', quantity: 2_000, unit: 'grams' },
    ],
  });

  assert.equal(result.success, false);
  assert.equal(
    result.error.issues.some((issue) => issue.message.includes('Combined')),
    true,
  );
});

test('recommendation request schema rejects empty, unsafe, unsupported, and authority input', () => {
  const invalidRequests = [
    emptyIngredientRequestFixture,
    { ingredients: [{ name: '<script>alert(1)</script>' }] },
    { ingredients: [{ name: 'rice', unit: 'grams' }] },
    { ingredients: [{ name: 'rice', quantity: 0, unit: 'grams' }] },
    { ingredients: [{ name: 'rice', quantity: 1, unit: 'bucket' }] },
    { ingredients: [{ name: 'rice', quantity: 1, unit: null }] },
    { ingredients: [{ name: 'rice' }], dietaryPreference: 'pescatarian' },
    { ingredients: [{ name: 'rice' }], maxCaloriesPerServing: '500' },
    { ingredients: [{ name: 'rice' }], resultCount: 6 },
    { ingredients: [{ name: 'rice' }], userId: '507f1f77bcf86cd799439011' },
    {
      ingredients: Array.from(
        { length: RECIPE_LIMITS.ingredientsPerRequest.max + 1 },
        (_, index) => ({ name: `ingredient ${index}` }),
      ),
    },
  ];

  for (const invalidRequest of invalidRequests) {
    assert.equal(recipeRecommendationRequestSchema.safeParse(invalidRequest).success, false);
  }
});

test('request middleware returns stable errors before provider work and passes normalized valid input', async () => {
  const acceptedInputs = [];
  const app = createRequestValidationApp((input) => acceptedInputs.push(input));

  const invalidResponse = await request(app)
    .post('/recommend')
    .send({ ingredients: [], userId: '507f1f77bcf86cd799439011' })
    .expect(400);

  assert.equal(acceptedInputs.length, 0);
  assert.equal(invalidResponse.body.error.code, 'VALIDATION_ERROR');
  assert.equal(invalidResponse.body.error.message, 'Please correct the highlighted fields.');
  assert.equal(Array.isArray(invalidResponse.body.error.details), true);
  assert.equal(invalidResponse.body.meta.apiVersion, '1');

  const validResponse = await request(app)
    .post('/recommend')
    .send({
      ingredients: [{ name: ' Tomato ' }, { name: 'tomato', quantity: 2, unit: 'pieces' }],
    })
    .expect(200);

  assert.equal(acceptedInputs.length, 1);
  assert.deepEqual(validResponse.body.data.ingredients, [
    { name: 'tomato', quantity: 2, unit: 'piece' },
  ]);
});

test('canonical recipe units convert only within compatible dimensions', () => {
  assert.equal(normalizeRecipeUnit(' TBSP '), 'tablespoon');
  assert.equal(normalizeRecipeUnit('unknown'), null);
  assert.equal(getRecipeUnitDimension('grams'), 'mass');
  assert.equal(getRecipeUnitDimension('cup'), 'volume');
  assert.equal(canConvertRecipeUnits('kilograms', 'grams'), true);
  assert.equal(canConvertRecipeUnits('cup', 'milliliters'), true);
  assert.equal(canConvertRecipeUnits('piece', 'grams'), false);
  assert.equal(convertRecipeQuantity(1.5, 'kilograms', 'grams'), 1_500);
  assert.equal(convertRecipeQuantity(2, 'tablespoon', 'milliliters'), 30);
  assert.throws(() => convertRecipeQuantity(1, 'piece', 'grams'), /Cannot convert piece to grams/);
});

test('provider output accepts bounded structured candidates and rejects model-owned nutrition', () => {
  const parsed = providerRecipeBatchSchema.parse({ recipes: [providerRecipeFixture] });
  assert.equal(parsed.recipes[0].ingredients[0].name, 'chickpeas');
  assert.equal(parsed.recipes[0].ingredients[2].unit, 'tablespoon');

  const withUntrustedNutrition = {
    ...providerRecipeFixture,
    nutrition: { calories: 10 },
  };
  assert.equal(
    providerRecipeBatchSchema.safeParse({ recipes: [withUntrustedNutrition] }).success,
    false,
  );

  assert.equal(
    providerRecipeBatchSchema.safeParse({
      recipes: [{ ...providerRecipeFixture, steps: Array(21).fill('Repeat this step.') }],
    }).success,
    false,
  );

  assert.equal(
    providerRecipeBatchSchema.safeParse({
      recipes: [
        providerRecipeFixture,
        { ...providerRecipeFixture, title: 'chickpea tomato rice bowl' },
      ],
    }).success,
    false,
  );

  assert.equal(
    providerRecipeBatchSchema.safeParse({
      recipes: [
        {
          ...providerRecipeFixture,
          ingredients: [
            ...providerRecipeFixture.ingredients,
            { name: 'Chickpeas', quantity: 1, unit: 'cup', optional: false },
          ],
        },
      ],
    }).success,
    false,
  );
});

test('enriched recipes require consistent time, steps, nutrition, and bounded scores', () => {
  assert.equal(enrichedRecipeSchema.safeParse(enrichedRecipeFixture).success, true);

  const invalidRecipes = [
    {
      ...enrichedRecipeFixture,
      time: { ...enrichedRecipeFixture.time, totalMinutes: 34 },
    },
    {
      ...enrichedRecipeFixture,
      steps: [{ number: 2, instruction: 'This sequence does not start at one.' }],
    },
    {
      ...enrichedRecipeFixture,
      nutritionPerServing: { ...enrichedRecipeFixture.nutritionPerServing, calories: -1 },
    },
    {
      ...enrichedRecipeFixture,
      match: { ...enrichedRecipeFixture.match, score: 101 },
    },
    {
      ...enrichedRecipeFixture,
      image: {
        ...enrichedRecipeFixture.image,
        url: 'https://untrusted.example/recipe.jpg',
      },
    },
  ];

  for (const invalidRecipe of invalidRecipes) {
    assert.equal(enrichedRecipeSchema.safeParse(invalidRecipe).success, false);
  }
});

test('generated recipe images require matching controlled URLs and ingredient provenance', () => {
  const signature = enrichedRecipeFixture.image.ingredientSignature;
  const generated = {
    ...enrichedRecipeFixture,
    image: {
      url: `/api/recipe-images/${signature}.jpg`,
      alt: `Generated serving of ${enrichedRecipeFixture.title}`,
      kind: 'generated',
      provider: 'cloudflare',
      ingredientSignature: signature,
    },
  };

  assert.equal(enrichedRecipeSchema.safeParse(generated).success, true);
  assert.equal(
    enrichedRecipeSchema.safeParse({
      ...generated,
      image: { ...generated.image, url: `/api/recipe-images/${'0'.repeat(64)}.jpg` },
    }).success,
    false,
  );
  assert.equal(
    enrichedRecipeSchema.safeParse({
      ...generated,
      image: { ...generated.image, url: 'https://untrusted.example/recipe.jpg' },
    }).success,
    false,
  );
});

test('recommendation responses enforce status and provider fallback consistency', () => {
  assert.equal(
    recipeRecommendationResponseSchema.safeParse(recommendationResponseFixture).success,
    true,
  );

  const noMatchWithRecipe = structuredClone(recommendationResponseFixture);
  noMatchWithRecipe.data.status = 'no_match';
  assert.equal(recipeRecommendationResponseSchema.safeParse(noMatchWithRecipe).success, false);

  const invalidFallback = structuredClone(recommendationResponseFixture);
  invalidFallback.data.provider = {
    requested: 'gemini',
    used: 'gemini',
    fallbackUsed: true,
    fallbackReason: null,
  };
  assert.equal(recipeRecommendationResponseSchema.safeParse(invalidFallback).success, false);

  const inconsistentSource = structuredClone(recommendationResponseFixture);
  inconsistentSource.data.recipes[0].source = 'bundled';
  assert.equal(recipeRecommendationResponseSchema.safeParse(inconsistentSource).success, false);

  const validNoMatch = structuredClone(recommendationResponseFixture);
  validNoMatch.data.status = 'no_match';
  validNoMatch.data.recipes = [];
  validNoMatch.data.provider = {
    requested: 'gemini',
    used: 'bundled',
    fallbackUsed: true,
    fallbackReason: 'quota_exhausted',
  };
  assert.equal(recipeRecommendationResponseSchema.safeParse(validNoMatch).success, true);
});

test('scenario fixtures cover supported diet, goal, calorie, and time inputs', () => {
  const validFixtures = [
    ingredientOnlyRequestFixture,
    vegetarianRequestFixture,
    eggetarianRequestFixture,
    veganRequestFixture,
    highProteinRequestFixture,
    calorieLimitedRequestFixture,
    timeLimitedRequestFixture,
  ];

  for (const fixture of validFixtures) {
    assert.equal(recipeRecommendationRequestSchema.safeParse(fixture).success, true);
  }

  assert.equal(
    recipeRecommendationRequestSchema.safeParse(emptyIngredientRequestFixture).success,
    false,
  );
  assert.equal(
    Object.values(RECIPE_SCORING_WEIGHTS).reduce((total, weight) => total + weight, 0),
    1,
  );
});
