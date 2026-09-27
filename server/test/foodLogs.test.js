import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import {
  createManualFoodLog,
  deleteManualFoodLog,
  getManualFoodLog,
  listManualFoodLogs,
  updateManualFoodLog,
} from '../src/services/foodLogService.js';
import * as foodCatalogService from '../src/services/foodCatalogService.js';
import {
  createFoodLogSchema,
  listFoodLogsQuerySchema,
  updateFoodLogSchema,
} from '../src/validators/foodLogValidators.js';

const userId = new mongoose.Types.ObjectId();

function catalogFood(overrides = {}) {
  return {
    id: 'usda-100',
    name: 'Paneer',
    description: 'USDA food',
    category: 'Dairy',
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
    ],
    nutrition: { calories: 265, protein: 18.3, carbohydrates: 1.2, fat: 20.8, fiber: 0 },
    missingNutrients: [],
    source: {
      provider: 'usda',
      label: 'USDA FoodData Central',
      externalId: '100',
      dataType: 'Foundation',
      license: 'CC0 1.0',
    },
    ...overrides,
  };
}

function catalogWithFood(food) {
  return {
    ...foodCatalogService,
    getCatalogFoodInternal: async () => food,
  };
}

function storedFoodLog(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    userId,
    date: '2026-08-27',
    mealType: 'lunch',
    mealOrder: 1,
    foodCatalogId: 'usda-100',
    foodName: 'Paneer',
    quantity: 100,
    unit: 'grams',
    calories: 265,
    protein: 18.3,
    carbohydrates: 1.2,
    fat: 20.8,
    fiber: 0,
    source: 'manual',
    createdAt: new Date('2026-08-27T10:00:00.000Z'),
    updatedAt: new Date('2026-08-27T10:00:00.000Z'),
    ...overrides,
  };
}

test('food-log validators strip forged authority and nutrition fields', () => {
  const parsed = createFoodLogSchema.parse({
    date: '2026-08-27',
    mealType: 'lunch',
    foodId: 'usda-100',
    quantity: 100,
    unit: 'grams',
    userId: new mongoose.Types.ObjectId().toString(),
    foodName: 'Forged food name',
    source: 'ai',
    calories: 1,
    protein: 999,
  });

  assert.deepEqual(parsed, {
    date: '2026-08-27',
    mealType: 'lunch',
    foodId: 'usda-100',
    quantity: 100,
    unit: 'grams',
  });
});

test('food-log validators enforce dates, meals, selections, quantities, units, and pagination', () => {
  assert.equal(
    createFoodLogSchema.safeParse({
      date: '2026-02-30',
      mealType: 'brunch',
      foodId: 'Paneer!',
      quantity: 0,
      unit: 'bucket',
    }).success,
    false,
  );
  assert.equal(updateFoodLogSchema.safeParse({ source: 'ai', calories: 1 }).success, false);
  assert.equal(listFoodLogsQuerySchema.safeParse({ page: 1001, limit: 101 }).success, false);
  assert.equal(
    createFoodLogSchema.safeParse({
      date: '2099-12-31',
      mealType: 'dinner',
      foodId: 'usda-200',
      quantity: 100,
      unit: 'grams',
    }).success,
    true,
  );
  assert.equal(
    createFoodLogSchema.safeParse({
      date: '2026-08-27',
      mealType: 'snack',
      foodId: 'usda-200',
      customFood: {
        name: 'Homemade poha',
        nutrition: { calories: 280, protein: 7, carbohydrates: 50, fat: 6, fiber: 5 },
      },
      quantity: 1,
      unit: 'serving',
    }).success,
    false,
  );
});

test('create derives identity, catalog data, source, and nutrition on the server', async () => {
  let persistedData;
  const repository = {
    createFoodLog: async (data) => {
      persistedData = data;
      return storedFoodLog({ ...data });
    },
  };

  const foodLog = await createManualFoodLog(
    {
      authenticatedUserId: userId,
      input: {
        date: '2026-08-27',
        mealType: 'lunch',
        foodId: 'usda-100',
        quantity: 200,
        unit: 'grams',
        userId: new mongoose.Types.ObjectId(),
        foodName: 'Forged',
        source: 'ai',
        calories: 1,
      },
    },
    { repository, catalog: catalogWithFood(catalogFood()) },
  );

  assert.equal(persistedData.userId, userId);
  assert.equal(persistedData.source, 'manual');
  assert.equal(persistedData.foodName, 'Paneer');
  assert.equal(persistedData.calories, 530);
  assert.equal(persistedData.protein, 36.6);
  assert.equal(foodLog.id.length, 24);
  assert.equal(foodLog.userId, undefined);
});

test('custom food creation persists explicit user-entered nutrition with provenance', async () => {
  let persistedData;
  const repository = {
    createFoodLog: async (data) => {
      persistedData = data;
      return storedFoodLog({ ...data });
    },
  };

  const foodLog = await createManualFoodLog(
    {
      authenticatedUserId: userId,
      input: {
        date: '2026-08-27',
        mealType: 'breakfast',
        customFood: {
          name: 'Homemade poha',
          nutrition: { calories: 280, protein: 7, carbohydrates: 50, fat: 6, fiber: 5 },
        },
        quantity: 250,
        unit: 'grams',
      },
    },
    { repository },
  );

  assert.match(persistedData.foodCatalogId, /^custom-[a-f0-9]{20}$/);
  assert.equal(persistedData.catalogSnapshot.source.provider, 'custom');
  assert.equal(foodLog.foodSource.provider, 'custom');
  assert.deepEqual(foodLog.nutrition, {
    calories: 280,
    protein: 7,
    carbohydrates: 50,
    fat: 6,
    fiber: 5,
  });
});

test('list scopes the repository request and returns safe pagination metadata', async () => {
  let repositoryInput;
  const repository = {
    listOwnedFoodLogs: async (input) => {
      repositoryInput = input;
      return { foodLogs: [storedFoodLog()], total: 26 };
    },
  };

  const result = await listManualFoodLogs(
    {
      authenticatedUserId: userId,
      date: '2026-08-27',
      page: 2,
      limit: 10,
    },
    { repository },
  );

  assert.deepEqual(repositoryInput, {
    userId,
    date: '2026-08-27',
    page: 2,
    limit: 10,
  });
  assert.deepEqual(result.pagination, { page: 2, limit: 10, total: 26, totalPages: 3 });
});

test('update uses an owned lookup and recalculates the complete nutrition snapshot', async () => {
  const foodLogId = new mongoose.Types.ObjectId();
  const calls = [];
  const repository = {
    findOwnedFoodLog: async (input) => {
      calls.push({ operation: 'find', input });
      return storedFoodLog({ _id: foodLogId });
    },
    updateOwnedFoodLog: async (input) => {
      calls.push({ operation: 'update', input });
      return storedFoodLog({ _id: foodLogId, ...input.update });
    },
  };

  const result = await updateManualFoodLog(
    {
      authenticatedUserId: userId,
      foodLogId: foodLogId.toString(),
      input: { mealType: 'dinner', foodId: 'usda-200', quantity: 200 },
    },
    {
      repository,
      catalog: catalogWithFood(
        catalogFood({
          id: 'usda-200',
          name: 'Rice',
          nutrition: {
            calories: 130,
            protein: 2.7,
            carbohydrates: 28.2,
            fat: 0.3,
            fiber: 0.4,
          },
          source: {
            provider: 'usda',
            label: 'USDA FoodData Central',
            externalId: '200',
            dataType: 'Foundation',
            license: 'CC0 1.0',
          },
        }),
      ),
    },
  );

  assert.equal(calls[0].input.userId, userId);
  assert.equal(calls[1].input.userId, userId);
  assert.equal(calls[1].input.update.foodCatalogId, 'usda-200');
  assert.equal(calls[1].input.update.mealType, 'dinner');
  assert.equal(calls[1].input.update.mealOrder, 2);
  assert.equal(calls[1].input.update.calories, 260);
  assert.equal(calls[1].input.update.carbohydrates, 56.4);
  assert.equal(calls[1].input.update.userId, undefined);
  assert.equal(calls[1].input.update.source, undefined);
  assert.equal(result.foodName, 'Rice');
  assert.equal(result.mealType, 'dinner');
});

test('get and delete pass authenticated ownership to the repository', async () => {
  const foodLogId = new mongoose.Types.ObjectId().toString();
  const calls = [];
  const repository = {
    findOwnedFoodLog: async (input) => {
      calls.push(input);
      return storedFoodLog({ _id: new mongoose.Types.ObjectId(foodLogId) });
    },
    deleteOwnedFoodLog: async (input) => {
      calls.push(input);
      return storedFoodLog({ _id: new mongoose.Types.ObjectId(foodLogId) });
    },
  };

  await getManualFoodLog({ authenticatedUserId: userId, foodLogId }, { repository });
  await deleteManualFoodLog({ authenticatedUserId: userId, foodLogId }, { repository });

  assert.deepEqual(calls, [
    { userId, foodLogId },
    { userId, foodLogId },
  ]);
});

test('missing and cross-user records share the same not-found response', async () => {
  const foodLogId = new mongoose.Types.ObjectId().toString();
  const repository = {
    findOwnedFoodLog: async () => null,
    deleteOwnedFoodLog: async () => null,
  };

  await assert.rejects(
    getManualFoodLog({ authenticatedUserId: userId, foodLogId }, { repository }),
    (error) => error.code === 'FOOD_LOG_NOT_FOUND' && error.statusCode === 404,
  );
  await assert.rejects(
    deleteManualFoodLog({ authenticatedUserId: userId, foodLogId }, { repository }),
    (error) => error.code === 'FOOD_LOG_NOT_FOUND' && error.statusCode === 404,
  );
});

test('food-log API requires authentication and exposes versioned sanitized errors', async () => {
  const response = await request(createApp()).get('/api/food-logs').expect(401);

  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
  assert.equal(response.body.meta.apiVersion, '1');
  assert.equal(typeof response.body.meta.requestId, 'string');
  assert.equal(response.headers['x-request-id'], response.body.meta.requestId);
});

test('database availability errors are mapped without exposing internal messages', async () => {
  const app = express();
  app.get('/failure', () => {
    const error = new Error('mongodb://username:password@private-host');
    error.name = 'MongooseServerSelectionError';
    throw error;
  });
  app.use(errorHandler);

  const response = await request(app).get('/failure').expect(503);
  assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE');
  assert.equal(JSON.stringify(response.body).includes('private-host'), false);
});
