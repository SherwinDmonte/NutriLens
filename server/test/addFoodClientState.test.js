import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import {
  mapApiFieldErrors,
  nutritionSnapshotsMatch,
  validateAddFoodDraft,
} from '../../client/src/utils/addFoodForm.js';
import {
  calculateNutritionSnapshotFromFood,
  getNutritionPreviewFromFood,
  serializeCatalogFood,
} from '../src/services/foodCatalogService.js';
import { createManualFoodLog } from '../src/services/foodLogService.js';

const riceInternal = {
  id: 'usda-200',
  name: 'Rice, cooked',
  description: 'USDA test fixture',
  category: 'Cereal Grains and Pasta',
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
      label: 'servings',
      referenceQuantityPerUnit: 150,
      defaultQuantity: 1,
      step: 0.25,
      min: 0.25,
      max: 20,
    },
  ],
  nutrition: { calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3, fiber: 0.4 },
  missingNutrients: [],
  source: {
    provider: 'usda',
    label: 'USDA FoodData Central',
    externalId: '200',
    dataType: 'Foundation',
    license: 'CC0 1.0',
  },
};
const rice = serializeCatalogFood(riceInternal);
const catalog = {
  getCatalogFoodInternal: async () => riceInternal,
  createCustomCatalogFood: () => {
    throw new Error('Not used by this test.');
  },
  calculateNutritionSnapshotFromFood,
};

test('Add Food client validation requires a meal, catalog selection, quantity, and supported unit', () => {
  assert.deepEqual(
    validateAddFoodDraft({
      mealType: 'brunch',
      selectedFood: null,
      quantity: '',
      unit: '',
    }),
    {
      mealType: 'Choose breakfast, lunch, dinner, or snack.',
      foodId: 'Choose a food from the search results.',
      quantity: 'Enter a quantity greater than 0.',
    },
  );

  assert.deepEqual(
    validateAddFoodDraft({
      mealType: 'lunch',
      selectedFood: rice,
      quantity: '5001',
      unit: 'grams',
    }),
    { quantity: 'Enter between 1 and 5000 grams.' },
  );

  assert.deepEqual(
    validateAddFoodDraft({
      mealType: 'lunch',
      selectedFood: rice,
      quantity: '200',
      unit: 'grams',
    }),
    {},
  );

  assert.deepEqual(
    validateAddFoodDraft({
      mode: 'custom',
      mealType: 'snack',
      selectedFood: null,
      customFood: {
        name: 'Homemade poha',
        calories: '280',
        protein: '7',
        carbohydrates: '50',
        fat: '6',
        fiber: '5',
      },
      quantity: '250',
      unit: 'grams',
    }),
    {},
  );

  assert.equal(
    validateAddFoodDraft({
      mode: 'custom',
      mealType: 'snack',
      customFood: {
        name: '',
        calories: '-1',
        protein: '',
        carbohydrates: '50',
        fat: '6',
        fiber: '5',
      },
      quantity: '1',
      unit: 'serving',
    }).calories,
    'Enter a valid calories value of 0 or more.',
  );
});

test('server validation details map back to Add Food fields', () => {
  const fields = mapApiFieldErrors({
    details: [
      { field: 'quantity', message: 'Quantity must be greater than 0.' },
      { field: 'foodId', message: 'Food is required.' },
    ],
  });

  assert.deepEqual(fields, {
    quantity: 'Quantity must be greater than 0.',
    foodId: 'Food is required.',
  });
});

test('server preview reconciles exactly with the server-saved nutrition response', async () => {
  const preview = getNutritionPreviewFromFood({
    food: riceInternal,
    quantity: 1.5,
    unit: 'serving',
  });
  const repository = {
    createFoodLog: async (data) => ({ _id: new mongoose.Types.ObjectId(), ...data }),
  };
  const foodLog = await createManualFoodLog(
    {
      authenticatedUserId: new mongoose.Types.ObjectId(),
      input: {
        date: '2026-08-27',
        mealType: 'dinner',
        foodId: 'usda-200',
        quantity: 1.5,
        unit: 'serving',
      },
    },
    { repository, catalog },
  );

  assert.deepEqual(foodLog.nutrition, preview.nutrition);
  assert.equal(nutritionSnapshotsMatch(preview, foodLog), true);
  assert.equal(
    nutritionSnapshotsMatch(preview, {
      ...foodLog,
      nutrition: { ...foodLog.nutrition, calories: foodLog.nutrition.calories + 1 },
    }),
    false,
  );
});
