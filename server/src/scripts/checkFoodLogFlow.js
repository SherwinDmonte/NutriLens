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
const testEmails = [`phase6-a-${testIdentity}@example.com`, `phase6-b-${testIdentity}@example.com`];
const testPassword = randomBytes(24).toString('hex');
const testDate = '2026-08-27';

function customFood(name, nutrition) {
  return { name, description: 'Disposable verification fixture', nutrition };
}

const paneer = customFood('Paneer', {
  calories: 530,
  protein: 36.6,
  carbohydrates: 2.4,
  fat: 41.6,
  fiber: 0,
});
const rice = customFood('Rice', {
  calories: 260,
  protein: 5.4,
  carbohydrates: 56.4,
  fat: 0.6,
  fiber: 0.8,
});
const eggs = customFood('Egg', {
  calories: 156,
  protein: 12.6,
  carbohydrates: 1.2,
  fat: 10.6,
  fiber: 0,
});

async function registerTestUser(browser, name, email) {
  const response = await browser
    .post('/api/auth/register')
    .set('Origin', env.clientOrigin)
    .send({ name, email, password: testPassword })
    .expect(201);
  return response.body.data.user;
}

async function checkFoodLogFlow() {
  try {
    assertAuthConfiguration();
    const connection = await connectDatabase();
    await ensureDatabaseSchema(connection);

    const app = createApp();
    const userABrowser = request.agent(app);
    const userBBrowser = request.agent(app);
    const userA = await registerTestUser(userABrowser, 'Phase 6 User A', testEmails[0]);
    const userB = await registerTestUser(userBBrowser, 'Phase 6 User B', testEmails[1]);

    const createResponse = await userABrowser
      .post('/api/food-logs')
      .set('Origin', env.clientOrigin)
      .send({
        date: testDate,
        mealType: 'lunch',
        customFood: paneer,
        quantity: 200,
        unit: 'grams',
        userId: userB.id,
        foodName: 'Forged name',
        source: 'ai',
        calories: 1,
        protein: 999,
      })
      .expect(201);

    const firstFoodLog = createResponse.body.data.foodLog;
    assert.equal(createResponse.body.meta.apiVersion, '1');
    assert.equal(firstFoodLog.foodName, 'Paneer');
    assert.equal(firstFoodLog.source, 'manual');
    assert.equal(firstFoodLog.nutrition.calories, 530);
    assert.equal(firstFoodLog.nutrition.protein, 36.6);
    assert.equal(firstFoodLog.userId, undefined);

    const persistedFoodLog = await FoodLog.findById(firstFoodLog.id).select('+mealOrder').lean();
    assert.equal(persistedFoodLog.userId.toString(), userA.id);
    assert.equal(persistedFoodLog.source, 'manual');
    assert.equal(persistedFoodLog.foodName, 'Paneer');
    assert.equal(persistedFoodLog.calories, 530);

    await userBBrowser.get(`/api/food-logs/${firstFoodLog.id}?userId=${userA.id}`).expect(404);
    await userBBrowser
      .patch(`/api/food-logs/${firstFoodLog.id}`)
      .set('Origin', env.clientOrigin)
      .send({ quantity: 1, userId: userA.id })
      .expect(404);
    await userBBrowser
      .delete(`/api/food-logs/${firstFoodLog.id}`)
      .set('Origin', env.clientOrigin)
      .expect(404);

    await userABrowser.get(`/api/food-logs?date=${testDate}&userId=${userB.id}`).expect(400);
    await userABrowser
      .post('/api/food-logs')
      .set('Origin', env.clientOrigin)
      .send({
        date: '2026-02-30',
        mealType: 'brunch',
        foodId: 'invalid!',
        quantity: 0,
        unit: 'bucket',
      })
      .expect(400);
    await userABrowser.get('/api/food-logs/not-an-object-id').expect(400);
    await userABrowser
      .patch(`/api/food-logs/${firstFoodLog.id}`)
      .set('Origin', env.clientOrigin)
      .send({})
      .expect(400);

    const updateResponse = await userABrowser
      .patch(`/api/food-logs/${firstFoodLog.id}`)
      .set('Origin', env.clientOrigin)
      .send({ mealType: 'dinner', customFood: rice, quantity: 200, unit: 'grams' })
      .expect(200);
    assert.equal(updateResponse.body.data.foodLog.foodName, 'Rice');
    assert.equal(updateResponse.body.data.foodLog.mealType, 'dinner');
    assert.equal(updateResponse.body.data.foodLog.nutrition.calories, 260);
    assert.equal(updateResponse.body.data.foodLog.nutrition.carbohydrates, 56.4);

    const breakfastResponse = await userABrowser
      .post('/api/food-logs')
      .set('Origin', env.clientOrigin)
      .send({
        date: testDate,
        mealType: 'breakfast',
        customFood: eggs,
        quantity: 2,
        unit: 'piece',
      })
      .expect(201);
    const secondFoodLog = breakfastResponse.body.data.foodLog;

    const listResponse = await userABrowser
      .get(`/api/food-logs?date=${testDate}&page=1&limit=25`)
      .expect(200);
    assert.deepEqual(
      listResponse.body.data.foodLogs.map((foodLog) => foodLog.mealType),
      ['breakfast', 'dinner'],
    );
    assert.deepEqual(listResponse.body.meta.pagination, {
      page: 1,
      limit: 25,
      total: 2,
      totalPages: 1,
    });

    const historyResponse = await userABrowser.get('/api/food-logs?page=1&limit=1').expect(200);
    assert.equal(historyResponse.body.data.foodLogs.length, 1);
    assert.equal(historyResponse.body.meta.pagination.total, 2);
    assert.equal(historyResponse.body.meta.pagination.totalPages, 2);

    await userABrowser.get(`/api/food-logs/${firstFoodLog.id}`).expect(200);
    await userABrowser
      .delete(`/api/food-logs/${firstFoodLog.id}`)
      .set('Origin', env.clientOrigin)
      .expect(204);
    await userABrowser
      .delete(`/api/food-logs/${secondFoodLog.id}`)
      .set('Origin', env.clientOrigin)
      .expect(204);
    await userABrowser.get(`/api/food-logs/${firstFoodLog.id}`).expect(404);

    console.log(
      'Food-log CRUD, invalid-input, identity-injection, recalculation, pagination, and two-user ownership checks passed.',
    );
  } finally {
    try {
      if (connectionIsAvailable()) {
        const temporaryUsers = await User.find({ email: { $in: testEmails } })
          .select('_id')
          .lean();
        const temporaryUserIds = temporaryUsers.map((user) => user._id);
        if (temporaryUserIds.length) {
          await FoodLog.deleteMany({ userId: { $in: temporaryUserIds } });
        }
        await User.deleteMany({ email: { $in: testEmails } });
        console.log('Temporary Phase 6 users and food logs removed.');
      }
    } finally {
      await disconnectDatabase();
    }
  }
}

function connectionIsAvailable() {
  return User.db.readyState === 1;
}

checkFoodLogFlow().catch((error) => {
  console.error(
    `Food-log flow check failed (${error.name || 'Error'}). Verify the server environment and Atlas access settings.`,
  );
  process.exitCode = 1;
});
