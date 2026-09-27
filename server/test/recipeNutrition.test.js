import assert from 'node:assert/strict';
import test from 'node:test';

import { ingredientNutritionCatalog } from '../src/data/ingredientNutrition.js';
import {
  bundledNutritionProvider,
  estimateBundledIngredient,
  findBundledIngredient,
} from '../src/providers/nutrition/bundledNutritionProvider.js';
import { assertNutritionProvider } from '../src/providers/nutrition/nutritionProvider.js';
import { estimateRecipeNutrition } from '../src/services/recipeNutritionService.js';
import { nutritionEstimateSchema } from '../src/validators/recipeRecommendationValidators.js';

const exampleRecipeIngredients = [
  { name: 'chickpeas', quantity: 200, unit: 'grams', optional: false },
  { name: 'tomato', quantity: 2, unit: 'piece', optional: false },
  { name: 'olive oil', quantity: 1, unit: 'tablespoon', optional: false },
];

test('bundled nutrition catalog is immutable, unique, and contains common pantry ingredients', () => {
  assert.equal(Object.isFrozen(ingredientNutritionCatalog), true);
  assert.equal(ingredientNutritionCatalog.length >= 40, true);
  assert.equal(
    new Set(ingredientNutritionCatalog.map((ingredient) => ingredient.id)).size,
    ingredientNutritionCatalog.length,
  );
  assert.equal(findBundledIngredient('  GARBANZO   BEANS ')?.id, 'chickpeas-cooked');
  assert.equal(findBundledIngredient('atta')?.id, 'whole-wheat-flour');
  assert.equal(findBundledIngredient('missing ingredient'), null);

  for (const ingredient of ingredientNutritionCatalog) {
    assert.equal(Object.isFrozen(ingredient), true);
    assert.deepEqual(Object.keys(ingredient.nutrition), [
      'calories',
      'protein',
      'carbohydrates',
      'fat',
      'fiber',
    ]);
    assert.equal(ingredient.reference.quantity > 0, true);
    assert.equal(ingredient.defaultMeasure.quantity > 0, true);
  }
});

test('explicit base quantities scale bundled nutrition without assumptions', () => {
  const estimate = estimateBundledIngredient({
    name: 'chickpeas',
    quantity: 200,
    unit: 'grams',
  });

  assert.equal(estimate.status, 'matched');
  assert.equal(estimate.resolved.baseQuantity, 200);
  assert.deepEqual(estimate.nutrition, {
    calories: 328,
    protein: 17.72,
    carbohydrates: 54.84,
    fat: 5.18,
    fiber: 15.2,
  });
  assert.equal(estimate.confidenceScore, 100);
  assert.deepEqual(estimate.assumptions, []);
});

test('standard volume conversion and ingredient-specific piece conversion stay distinct', () => {
  const milk = estimateBundledIngredient({ name: 'milk', quantity: 1, unit: 'cup' });
  const tomatoes = estimateBundledIngredient({ name: 'tomato', quantity: 2, unit: 'piece' });

  assert.equal(milk.resolved.baseQuantity, 240);
  assert.equal(milk.nutrition.calories, 146.4);
  assert.equal(milk.confidenceScore, 100);
  assert.deepEqual(milk.assumptions, []);

  assert.equal(tomatoes.resolved.baseQuantity, 246);
  assert.equal(tomatoes.nutrition.calories, 44.28);
  assert.equal(tomatoes.confidenceScore, 90);
  assert.deepEqual(
    tomatoes.assumptions.map((assumption) => assumption.code),
    ['ingredient_specific_conversion'],
  );
});

test('missing amounts and units use explicit defaults with reduced confidence', () => {
  const missingAmount = estimateBundledIngredient({ name: 'tomato', quantity: null, unit: null });
  const missingUnit = estimateBundledIngredient({ name: 'tomato', quantity: 2, unit: null });

  assert.equal(missingAmount.resolved.quantity, 1);
  assert.equal(missingAmount.resolved.unit, 'piece');
  assert.equal(missingAmount.resolved.baseQuantity, 123);
  assert.equal(missingAmount.confidenceScore, 65);
  assert.deepEqual(
    missingAmount.assumptions.map((assumption) => assumption.code),
    ['default_quantity', 'ingredient_specific_conversion'],
  );

  assert.equal(missingUnit.resolved.quantity, 2);
  assert.equal(missingUnit.resolved.unit, 'piece');
  assert.equal(missingUnit.confidenceScore, 75);
  assert.deepEqual(
    missingUnit.assumptions.map((assumption) => assumption.code),
    ['default_unit', 'ingredient_specific_conversion'],
  );
});

test('unknown ingredients and unsupported conversions are not silently estimated', () => {
  const unknown = estimateBundledIngredient({ name: 'moon fruit', quantity: 100, unit: 'grams' });
  const unsupported = estimateBundledIngredient({
    name: 'chicken breast',
    quantity: 1,
    unit: 'cup',
  });

  assert.equal(unknown.status, 'unmatched');
  assert.equal(unknown.reason, 'unknown_ingredient');
  assert.equal(unknown.confidenceScore, 0);
  assert.equal(unsupported.status, 'unmatched');
  assert.equal(unsupported.reason, 'unsupported_conversion');
});

test('recipe nutrition sums ingredient references and divides them by servings deterministically', () => {
  const result = estimateRecipeNutrition({ ingredients: exampleRecipeIngredients, servings: 2 });

  assert.deepEqual(result.totalNutrition, {
    calories: 493.2,
    protein: 19.88,
    carbohydrates: 64.41,
    fat: 19.37,
    fiber: 18.15,
  });
  assert.deepEqual(
    {
      calories: result.nutritionPerServing.calories,
      protein: result.nutritionPerServing.protein,
      carbohydrates: result.nutritionPerServing.carbohydrates,
      fat: result.nutritionPerServing.fat,
      fiber: result.nutritionPerServing.fiber,
    },
    {
      calories: 246.6,
      protein: 9.94,
      carbohydrates: 32.2,
      fat: 9.68,
      fiber: 9.08,
    },
  );
  assert.equal(result.nutritionPerServing.coveragePercent, 100);
  assert.deepEqual(result.nutritionPerServing.confidence, { score: 97, level: 'high' });
  assert.equal(result.nutritionPerServing.estimated, true);
  assert.equal(result.nutritionPerServing.provider, 'bundled');
  assert.equal(nutritionEstimateSchema.safeParse(result.nutritionPerServing).success, true);
  assert.deepEqual(
    estimateRecipeNutrition({ ingredients: exampleRecipeIngredients, servings: 2 }),
    result,
  );
});

test('coverage and confidence expose unknown required ingredients', () => {
  const result = estimateRecipeNutrition({
    ingredients: [
      { name: 'chickpeas', quantity: 100, unit: 'grams', optional: false },
      { name: 'moon fruit', quantity: 100, unit: 'grams', optional: false },
    ],
    servings: 1,
  });

  assert.deepEqual(result.totalNutrition, {
    calories: 164,
    protein: 8.86,
    carbohydrates: 27.42,
    fat: 2.59,
    fiber: 7.6,
  });
  assert.equal(result.nutritionPerServing.coveragePercent, 50);
  assert.deepEqual(result.nutritionPerServing.confidence, { score: 50, level: 'low' });
  assert.deepEqual(result.nutritionPerServing.unmatchedIngredients, ['moon fruit']);
  assert.equal(
    result.nutritionPerServing.assumptions.some(
      (assumption) => assumption.code === 'unknown_ingredient',
    ),
    true,
  );
});

test('optional ingredients are excluded and disclosed rather than silently included', () => {
  const result = estimateRecipeNutrition({
    ingredients: [
      { name: 'chickpeas', quantity: 100, unit: 'grams', optional: false },
      { name: 'butter', quantity: 1, unit: 'tablespoon', optional: true },
    ],
    servings: 1,
  });

  assert.equal(result.totalNutrition.calories, 164);
  assert.equal(result.nutritionPerServing.coveragePercent, 100);
  assert.deepEqual(result.nutritionPerServing.confidence, { score: 97, level: 'high' });
  assert.equal(
    result.nutritionPerServing.assumptions.some(
      (assumption) => assumption.code === 'optional_ingredient_excluded',
    ),
    true,
  );
});

test('nutrition provider interface is replaceable and rejects incomplete adapters', () => {
  const replacementProvider = {
    name: 'bundled',
    provenance: {
      dataset: 'test-nutrition-provider',
      version: '1.0',
      calculationMethod: 'reference-scaling',
    },
    estimateIngredient: ({ name }) => ({
      status: 'matched',
      inputName: name,
      nutrition: { calories: 100, protein: 10, carbohydrates: 5, fat: 2, fiber: 1 },
      confidenceScore: 100,
      assumptions: [],
    }),
  };

  const result = estimateRecipeNutrition(
    {
      ingredients: [{ name: 'test ingredient', quantity: 1, unit: 'piece', optional: false }],
      servings: 2,
    },
    { provider: replacementProvider },
  );

  assert.equal(result.nutritionPerServing.calories, 50);
  assert.equal(result.nutritionPerServing.provenance.dataset, 'test-nutrition-provider');
  assert.equal(assertNutritionProvider(bundledNutritionProvider), bundledNutritionProvider);
  assert.throws(() => assertNutritionProvider({ name: 'broken' }), /estimateIngredient/);
});

test('recipe nutrition rejects invalid recipe structure before calculation', () => {
  assert.throws(
    () => estimateRecipeNutrition({ ingredients: [], servings: 1 }),
    /at least one ingredient/,
  );
  assert.throws(
    () => estimateRecipeNutrition({ ingredients: exampleRecipeIngredients, servings: 0 }),
    /positive integer/,
  );
  assert.throws(
    () => estimateBundledIngredient({ name: 'tomato', quantity: -1, unit: 'grams' }),
    /greater than 0/,
  );
});
