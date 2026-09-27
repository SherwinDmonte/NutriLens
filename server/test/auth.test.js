import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/services/authService.js';
import {
  getSessionCookieOptions,
  signAccessToken,
  verifyAccessToken,
} from '../src/services/tokenService.js';
import { loginSchema, registerSchema } from '../src/validators/authValidators.js';

const TEST_SECRET = 'test-secret-'.padEnd(80, 'x');

test('registration validation normalizes identity fields', () => {
  const result = registerSchema.parse({
    name: '  Sherwin  ',
    email: '  SHERWIN@EXAMPLE.COM  ',
    password: 'a-secure-test-password',
  });

  assert.deepEqual(result, {
    name: 'Sherwin',
    email: 'sherwin@example.com',
    password: 'a-secure-test-password',
  });
});

test('registration and login validation reject malformed input', () => {
  assert.equal(
    registerSchema.safeParse({ name: 'S', email: 'invalid', password: 'short' }).success,
    false,
  );
  assert.equal(loginSchema.safeParse({ email: 'invalid', password: '' }).success, false);
});

test('passwords are salted, hashed, and compared without retaining plaintext', async () => {
  const password = 'a-secure-test-password';
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, password);
  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword('wrong-password', firstHash), false);
});

test('access tokens require the configured algorithm, audience, issuer, and secret', () => {
  const userId = new mongoose.Types.ObjectId();
  const token = signAccessToken(userId, TEST_SECRET);
  const payload = verifyAccessToken(token, TEST_SECRET);

  assert.equal(payload.sub, userId.toString());
  assert.equal(payload.type, 'access');
  assert.throws(() => verifyAccessToken(token, `${TEST_SECRET}-wrong`));
  assert.throws(() => verifyAccessToken('malformed-token', TEST_SECRET));

  const expiredToken = jwt.sign({ type: 'access' }, TEST_SECRET, {
    algorithm: 'HS256',
    audience: 'nutrilens-web',
    expiresIn: -1,
    issuer: 'nutrilens-api',
    subject: userId.toString(),
  });
  assert.throws(() => verifyAccessToken(expiredToken, TEST_SECRET), /expired/i);
});

test('session cookies are inaccessible to JavaScript and use same-site protection', () => {
  const options = getSessionCookieOptions();

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
  assert.equal(options.maxAge > 0, true);
});

test('invalid registration input uses the stable validation error shape', async () => {
  const response = await request(createApp())
    .post('/api/auth/register')
    .set('Origin', 'http://localhost:5173')
    .send({ name: 'S', email: 'invalid', password: 'short' })
    .expect(400);

  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.equal(Array.isArray(response.body.error.details), true);
  assert.deepEqual(response.body.error.details.map((detail) => detail.field).sort(), [
    'email',
    'name',
    'password',
  ]);
});

test('registration rejects client-supplied identity and unknown fields', async () => {
  const response = await request(createApp())
    .post('/api/auth/register')
    .set('Origin', 'http://localhost:5173')
    .send({
      name: 'Sherwin',
      email: 'sherwin@example.com',
      password: 'a-secure-test-password',
      userId: new mongoose.Types.ObjectId().toString(),
    })
    .expect(400);

  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.equal(response.body.error.details[0].field, 'body');
});

test('protected session endpoint rejects requests without a cookie', async () => {
  const response = await request(createApp()).get('/api/auth/me').expect(401);

  assert.deepEqual(response.body.error, {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Please log in to continue.',
  });
});

test('unsafe cross-origin auth requests are rejected before route handling', async () => {
  const response = await request(createApp())
    .post('/api/auth/login')
    .set('Origin', 'https://malicious.example')
    .send({ email: 'person@example.com', password: 'valid-password' })
    .expect(403);

  assert.deepEqual(response.body.error, {
    code: 'ORIGIN_REJECTED',
    message: 'This request origin is not allowed.',
  });
});
