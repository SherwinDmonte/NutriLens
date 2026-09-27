import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import { createApp } from '../app.js';
import { ensureDatabaseSchema } from '../config/databaseSchema.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { assertAuthConfiguration, env } from '../config/env.js';
import { User } from '../models/User.js';

const testIdentity = randomBytes(8).toString('hex');
const testEmail = `phase4-check-${Date.now()}-${testIdentity}@example.com`;
const testPassword = randomBytes(24).toString('hex');

async function checkAuthFlow() {
  let testUserCreated = false;

  try {
    assertAuthConfiguration();
    const connection = await connectDatabase();
    await ensureDatabaseSchema(connection);

    const app = createApp();
    const browser = request.agent(app);
    const registerResponse = await browser
      .post('/api/auth/register')
      .set('Origin', env.clientOrigin)
      .send({ name: 'Phase 4 Check', email: testEmail, password: testPassword })
      .expect(201);

    testUserCreated = true;
    assert.equal(registerResponse.body.data.user.email, testEmail);
    assert.equal(registerResponse.body.data.user.passwordHash, undefined);
    assert.match(registerResponse.headers['set-cookie'][0], /HttpOnly/i);
    assert.match(registerResponse.headers['set-cookie'][0], /SameSite=Lax/i);

    const duplicateResponse = await request(app)
      .post('/api/auth/register')
      .set('Origin', env.clientOrigin)
      .send({ name: 'Duplicate Check', email: testEmail, password: testPassword })
      .expect(409);
    assert.equal(duplicateResponse.body.error.code, 'ACCOUNT_EXISTS');

    const invalidLoginResponse = await request(app)
      .post('/api/auth/login')
      .set('Origin', env.clientOrigin)
      .send({ email: testEmail, password: `${testPassword}-wrong` })
      .expect(401);
    assert.equal(invalidLoginResponse.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(invalidLoginResponse.body.error.message.includes(testEmail), false);

    await browser.get('/api/auth/me').expect(200);
    await browser.post('/api/auth/logout').set('Origin', env.clientOrigin).expect(204);
    await browser.get('/api/auth/me').expect(401);

    await browser
      .post('/api/auth/login')
      .set('Origin', env.clientOrigin)
      .send({ email: testEmail, password: testPassword })
      .expect(200);
    await browser.get('/api/auth/me').expect(200);

    const previewResponse = await browser
      .post('/api/foods/custom/nutrition')
      .set('Origin', env.clientOrigin)
      .send({
        quantity: 200,
        unit: 'grams',
        customFood: {
          name: 'Paneer verification fixture',
          nutrition: {
            calories: 530,
            protein: 36.6,
            carbohydrates: 2.4,
            fat: 41.6,
            fiber: 0,
          },
        },
      })
      .expect(200);
    assert.equal(previewResponse.body.data.preview.nutrition.calories, 530);
    assert.equal(previewResponse.body.data.preview.nutrition.protein, 36.6);

    console.log(
      'Authentication, duplicate-account, session, privacy, and food catalog checks passed against NutriLens.',
    );
  } finally {
    if (testUserCreated) {
      await User.deleteOne({ email: testEmail });
      console.log('Temporary authentication-check user removed.');
    }
    await disconnectDatabase();
  }
}

checkAuthFlow().catch((error) => {
  console.error(
    `Authentication or catalog flow check failed (${error.name || 'Error'}). Verify the JWT secret and Atlas access settings.`,
  );
  process.exitCode = 1;
});
