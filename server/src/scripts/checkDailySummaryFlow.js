import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { createApp } from '../app.js';
import { ensureDatabaseSchema } from '../config/databaseSchema.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { assertAuthConfiguration, env } from '../config/env.js';
import { FoodLog } from '../models/FoodLog.js';
import { User } from '../models/User.js';

const testIdentity = `${Date.now()}-${randomBytes(8).toString('hex')}`;
const testEmails = [`phase7-a-${testIdentity}@example.com`, `phase7-b-${testIdentity}@example.com`];
const testPassword = randomBytes(24).toString('hex');
const selectedDate = '2026-08-27';
const otherDate = '2026-08-28';
const overTargetDate = '2026-08-29';
const emptyDate = '2026-08-30';

function customFood(name, nutrition) {
  return { name, description: 'Disposable verification fixture', nutrition };
}

const foods = Object.freeze({
  rice: customFood('Rice', {
    calories: 260,
    protein: 5.4,
    carbohydrates: 56.4,
    fat: 0.6,
    fiber: 0.8,
  }),
  egg: customFood('Egg', {
    calories: 156,
    protein: 12.6,
    carbohydrates: 1.2,
    fat: 10.6,
    fiber: 0,
  }),
  banana: customFood('Banana', {
    calories: 105,
    protein: 1.3,
    carbohydrates: 27,
    fat: 0.4,
    fiber: 3.1,
  }),
  paneer: customFood('Paneer', {
    calories: 530,
    protein: 36.6,
    carbohydrates: 2.4,
    fat: 41.6,
    fiber: 0,
  }),
  riceOverTarget: customFood('Rice', {
    calories: 2600,
    protein: 54,
    carbohydrates: 564,
    fat: 6,
    fiber: 8,
  }),
});

async function registerTestUser(browser, name, email) {
  const response = await browser
    .post('/api/auth/register')
    .set('Origin', env.clientOrigin)
    .send({ name, email, password: testPassword })
    .expect(201);
  return response.body.data.user;
}

async function addFood(browser, input) {
  return browser.post('/api/food-logs').set('Origin', env.clientOrigin).send(input).expect(201);
}

async function checkDailySummaryFlow() {
  try {
    assertAuthConfiguration();
    const connection = await connectDatabase();
    await ensureDatabaseSchema(connection);

    const app = createApp();
    const userABrowser = request.agent(app);
    const userBBrowser = request.agent(app);
    const userA = await registerTestUser(userABrowser, 'Phase 7 User A', testEmails[0]);
    await registerTestUser(userBBrowser, 'Phase 7 User B', testEmails[1]);

    await addFood(userABrowser, {
      date: selectedDate,
      mealType: 'lunch',
      customFood: foods.rice,
      quantity: 200,
      unit: 'grams',
    });
    await addFood(userABrowser, {
      date: selectedDate,
      mealType: 'breakfast',
      customFood: foods.egg,
      quantity: 2,
      unit: 'piece',
    });
    await addFood(userABrowser, {
      date: otherDate,
      mealType: 'snack',
      customFood: foods.banana,
      quantity: 1,
      unit: 'piece',
    });
    await addFood(userBBrowser, {
      date: selectedDate,
      mealType: 'dinner',
      customFood: foods.paneer,
      quantity: 200,
      unit: 'grams',
    });

    await FoodLog.create({
      userId: userA.id,
      date: selectedDate,
      mealType: 'snack',
      foodCatalogId: 'future-ai-check',
      foodName: 'Future AI Check',
      quantity: 1,
      unit: 'serving',
      calories: 9999,
      protein: 999,
      carbohydrates: 999,
      fat: 999,
      fiber: 999,
      source: 'ai',
    });

    const selectedResponse = await userABrowser
      .get(`/api/food-logs/summary?date=${selectedDate}`)
      .expect(200);
    const selectedSummary = selectedResponse.body.data.summary;
    assert.deepEqual(selectedSummary.consumed, {
      calories: 416,
      protein: 18,
      carbohydrates: 57.6,
      fat: 11.2,
      fiber: 0.8,
    });
    assert.deepEqual(selectedSummary.remaining, {
      calories: 1584,
      protein: 82,
      carbohydrates: 192.4,
      fat: 55.8,
    });
    assert.deepEqual(selectedSummary.completionPercentage, {
      calories: 20.8,
      protein: 18,
      carbohydrates: 23,
      fat: 16.7,
    });
    assert.deepEqual(selectedSummary.mealCalories, {
      breakfast: 156,
      lunch: 260,
      dinner: 0,
      snack: 0,
    });

    const userBSummaryResponse = await userBBrowser
      .get(`/api/food-logs/summary?date=${selectedDate}`)
      .expect(200);
    assert.equal(userBSummaryResponse.body.data.summary.consumed.calories, 530);
    await userBBrowser
      .get(`/api/food-logs/summary?date=${selectedDate}&userId=${userA.id}`)
      .expect(400);

    const userBListResponse = await userBBrowser
      .get(`/api/food-logs?date=${selectedDate}&page=1&limit=25`)
      .expect(200);
    assert.deepEqual(
      userBListResponse.body.data.foodLogs.map((foodLog) => foodLog.foodName),
      ['Paneer'],
    );

    const otherDateResponse = await userABrowser
      .get(`/api/food-logs/summary?date=${otherDate}`)
      .expect(200);
    assert.equal(otherDateResponse.body.data.summary.consumed.calories, 105);
    assert.equal(otherDateResponse.body.data.summary.mealCalories.snack, 105);

    const emptyResponse = await userABrowser
      .get(`/api/food-logs/summary?date=${emptyDate}`)
      .expect(200);
    assert.deepEqual(emptyResponse.body.data.summary.consumed, {
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      fiber: 0,
    });
    assert.deepEqual(emptyResponse.body.data.summary.remaining, {
      calories: 2000,
      protein: 100,
      carbohydrates: 250,
      fat: 67,
    });

    await addFood(userABrowser, {
      date: overTargetDate,
      mealType: 'dinner',
      customFood: foods.riceOverTarget,
      quantity: 2000,
      unit: 'grams',
    });
    const overTargetResponse = await userABrowser
      .get(`/api/food-logs/summary?date=${overTargetDate}`)
      .expect(200);
    const overTargetSummary = overTargetResponse.body.data.summary;
    assert.equal(overTargetSummary.consumed.calories, 2600);
    assert.equal(overTargetSummary.remaining.calories, 0);
    assert.equal(overTargetSummary.completionPercentage.calories, 130);
    assert.equal(overTargetSummary.visualCompletionPercentage.calories, 100);
    assert.equal(overTargetSummary.overTarget.calories, 600);
    assert.equal(overTargetSummary.completionPercentage.carbohydrates, 225.6);
    assert.equal(overTargetSummary.visualCompletionPercentage.carbohydrates, 100);
    assert.equal(overTargetSummary.overTarget.carbohydrates, 314);

    console.log('Daily summary totals, targets, dates, ownership, and over-target checks passed.');
  } finally {
    try {
      if (User.db.readyState === 1) {
        const temporaryUsers = await User.find({ email: { $in: testEmails } })
          .select('_id')
          .lean();
        const temporaryUserIds = temporaryUsers.map((user) => user._id);
        if (temporaryUserIds.length) {
          await FoodLog.deleteMany({ userId: { $in: temporaryUserIds } });
        }
        await User.deleteMany({ email: { $in: testEmails } });
        console.log('Temporary Phase 7 users and food logs removed.');
      }
    } finally {
      await disconnectDatabase();
    }
  }
}

checkDailySummaryFlow().catch((error) => {
  console.error(
    `Daily summary flow check failed (${error.name || 'Error'}). Verify the server environment and Atlas access settings.`,
  );
  process.exitCode = 1;
});
