import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import { FoodLog, User } from '../src/models/index.js';
import { buildManualFoodLog } from '../src/services/foodLogService.js';
import { isCanonicalCalendarDate } from '../src/utils/calendarDate.js';

const validFoodLog = {
  userId: new mongoose.Types.ObjectId(),
  date: '2026-08-27',
  mealType: 'lunch',
  foodCatalogId: 'paneer',
  foodName: 'Paneer',
  quantity: 100,
  unit: 'grams',
  calories: 265,
  protein: 18.3,
  carbohydrates: 1.2,
  fat: 20.8,
  fiber: 0,
};

test('calendar dates require a real YYYY-MM-DD value', () => {
  assert.equal(isCanonicalCalendarDate('2026-08-27'), true);
  assert.equal(isCanonicalCalendarDate('2026-02-29'), false);
  assert.equal(isCanonicalCalendarDate('2024-02-29'), true);
  assert.equal(isCanonicalCalendarDate('27-08-2026'), false);
});

test('User normalizes email and never serializes passwordHash', async () => {
  const user = new User({
    name: 'Sherwin',
    email: '  SHERWIN@EXAMPLE.COM ',
    passwordHash: 'hashed-password-placeholder',
  });

  await user.validate();

  assert.equal(user.email, 'sherwin@example.com');
  assert.equal(user.toJSON().passwordHash, undefined);
  assert.equal(User.schema.path('passwordHash').options.select, false);
});

test('FoodLog accepts an extensible valid manual nutrition snapshot', async () => {
  const foodLog = new FoodLog(validFoodLog);
  await foodLog.validate();

  assert.equal(foodLog.source, 'manual');
  assert.equal(foodLog.mealType, 'lunch');
});

test('manual food-log construction ignores client identity and source fields', async () => {
  const authenticatedUserId = new mongoose.Types.ObjectId();
  const foodLog = await buildManualFoodLog({
    authenticatedUserId,
    input: {
      date: validFoodLog.date,
      mealType: validFoodLog.mealType,
      quantity: validFoodLog.quantity,
      unit: validFoodLog.unit,
      customFood: {
        name: validFoodLog.foodName,
        nutrition: {
          calories: validFoodLog.calories,
          protein: validFoodLog.protein,
          carbohydrates: validFoodLog.carbohydrates,
          fat: validFoodLog.fat,
          fiber: validFoodLog.fiber,
        },
      },
      userId: new mongoose.Types.ObjectId(),
      source: 'ai',
    },
  });

  await foodLog.validate();

  assert.equal(foodLog.userId.toString(), authenticatedUserId.toString());
  assert.equal(foodLog.source, 'manual');
});

test('FoodLog rejects invalid dates, meal types, quantities, units, and nutrition', async () => {
  const foodLog = new FoodLog({
    ...validFoodLog,
    date: '2026-02-30',
    mealType: 'brunch',
    quantity: 0,
    unit: 'bucket',
    calories: -1,
  });

  await assert.rejects(foodLog.validate(), (validationError) => {
    assert.ok(validationError.errors.date);
    assert.ok(validationError.errors.mealType);
    assert.ok(validationError.errors.quantity);
    assert.ok(validationError.errors.unit);
    assert.ok(validationError.errors.calories);
    return true;
  });
});

test('FoodLog defines per-user date indexes for logs and summaries', () => {
  const indexNames = FoodLog.schema.indexes().map(([, options]) => options.name);

  assert.ok(indexNames.includes('foodlogs_by_user_date_meal'));
  assert.ok(indexNames.includes('foodlogs_summary_by_user_date_source'));
  assert.ok(indexNames.includes('foodlogs_owned_history_order'));
});
