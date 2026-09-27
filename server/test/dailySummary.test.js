import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../src/app.js';
import {
  calculateDailySummary,
  getDailyNutritionSummary,
} from '../src/services/dailySummaryService.js';
import { dailySummaryQuerySchema } from '../src/validators/foodLogValidators.js';

const date = '2026-08-27';

test('empty days return zero consumed, full remaining targets, and explicit meal zeros', () => {
  const summary = calculateDailySummary({ date, rawTotals: null });

  assert.deepEqual(summary, {
    date,
    targets: { calories: 2000, protein: 100, carbohydrates: 250, fat: 67 },
    consumed: { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 },
    remaining: { calories: 2000, protein: 100, carbohydrates: 250, fat: 67 },
    completionPercentage: { calories: 0, protein: 0, carbohydrates: 0, fat: 0 },
    visualCompletionPercentage: { calories: 0, protein: 0, carbohydrates: 0, fat: 0 },
    overTarget: { calories: 0, protein: 0, carbohydrates: 0, fat: 0 },
    mealCalories: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
  });
});

test('daily summary rounds displayed totals before deriving remaining and percentages', () => {
  const summary = calculateDailySummary({
    date,
    rawTotals: {
      calories: 1012.04,
      protein: 52.004,
      carbohydrates: 125.006,
      fat: 31.126,
      fiber: 18.126,
      mealCalories: { breakfast: 260.04, lunch: 647.06, snack: 104.94 },
    },
  });

  assert.deepEqual(summary.consumed, {
    calories: 1012,
    protein: 52,
    carbohydrates: 125.01,
    fat: 31.13,
    fiber: 18.13,
  });
  assert.deepEqual(summary.remaining, {
    calories: 988,
    protein: 48,
    carbohydrates: 124.99,
    fat: 35.87,
  });
  assert.deepEqual(summary.completionPercentage, {
    calories: 50.6,
    protein: 52,
    carbohydrates: 50,
    fat: 46.5,
  });
  assert.deepEqual(summary.mealCalories, {
    breakfast: 260,
    lunch: 647.1,
    dinner: 0,
    snack: 104.9,
  });
});

test('exact targets return zero remaining and no over-target amount', () => {
  const summary = calculateDailySummary({
    date,
    rawTotals: {
      calories: 2000,
      protein: 100,
      carbohydrates: 250,
      fat: 67,
      fiber: 20,
    },
  });

  assert.deepEqual(summary.remaining, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  assert.deepEqual(summary.completionPercentage, {
    calories: 100,
    protein: 100,
    carbohydrates: 100,
    fat: 100,
  });
  assert.deepEqual(summary.overTarget, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
});

test('over-target percentages remain accurate while only visual percentages are capped', () => {
  const summary = calculateDailySummary({
    date,
    rawTotals: {
      calories: 2500,
      protein: 112,
      carbohydrates: 300,
      fat: 100,
      fiber: 25,
    },
  });

  assert.deepEqual(summary.remaining, { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  assert.deepEqual(summary.completionPercentage, {
    calories: 125,
    protein: 112,
    carbohydrates: 120,
    fat: 149.3,
  });
  assert.deepEqual(summary.visualCompletionPercentage, {
    calories: 100,
    protein: 100,
    carbohydrates: 100,
    fat: 100,
  });
  assert.deepEqual(summary.overTarget, {
    calories: 500,
    protein: 12,
    carbohydrates: 50,
    fat: 33,
  });
});

test('rounding boundaries keep displayed consumed and remaining values consistent', () => {
  const summary = calculateDailySummary({
    date,
    rawTotals: { protein: 99.999, calories: 0, carbohydrates: 0, fat: 0, fiber: 0 },
  });

  assert.equal(summary.consumed.protein, 100);
  assert.equal(summary.remaining.protein, 0);
  assert.equal(summary.completionPercentage.protein, 100);
  assert.equal(summary.overTarget.protein, 0);
});

test('daily summary repository requests contain only authenticated user and selected date', async () => {
  const authenticatedUserId = new mongoose.Types.ObjectId().toString();
  let repositoryInput;
  const repository = {
    getOwnedDailyNutritionTotals: async (input) => {
      repositoryInput = input;
      return { calories: 130, mealCalories: { lunch: 130 } };
    },
  };

  const summary = await getDailyNutritionSummary({ authenticatedUserId, date }, { repository });

  assert.deepEqual(repositoryInput, { userId: authenticatedUserId, date });
  assert.equal(summary.consumed.calories, 130);
  assert.equal(summary.mealCalories.lunch, 130);
});

test('daily summary query requires one canonical calendar date and rejects extra authority fields', () => {
  assert.equal(dailySummaryQuerySchema.safeParse({ date }).success, true);
  assert.equal(dailySummaryQuerySchema.safeParse({}).success, false);
  assert.equal(dailySummaryQuerySchema.safeParse({ date: '2026-02-30' }).success, false);
  assert.equal(dailySummaryQuerySchema.safeParse({ date, userId: 'forged' }).success, false);
});

test('daily summary endpoint requires an authenticated session', async () => {
  const response = await request(createApp())
    .get(`/api/food-logs/summary?date=${date}`)
    .expect(401);

  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
  assert.equal(response.body.meta.apiVersion, '1');
});
