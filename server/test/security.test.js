import assert from 'node:assert/strict';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { createRequireAuth } from '../src/middleware/authMiddleware.js';
import { createAuthRateLimit } from '../src/middleware/authRateLimit.js';
import { createErrorHandler, errorHandler } from '../src/middleware/errorHandler.js';
import { createRequestLogger } from '../src/middleware/requestLogger.js';
import { registerUser, toPublicUser } from '../src/services/authService.js';
import { signAccessToken, verifyAccessToken } from '../src/services/tokenService.js';
import { User } from '../src/models/User.js';

const TEST_SECRET = 'phase-14-test-secret-'.padEnd(80, 'x');
const TEST_COOKIE = 'phase14_session';
const TEST_USER_ID = new mongoose.Types.ObjectId().toString();

function createProtectedTestApp({ findUser = async (userId) => ({ id: userId }) } = {}) {
  const app = express();
  app.use(cookieParser());
  app.get(
    '/protected',
    createRequireAuth({
      cookieName: TEST_COOKIE,
      findUser,
      verifyToken: (token) => verifyAccessToken(token, TEST_SECRET),
    }),
    (req, res) => res.status(200).json({ userId: req.auth.userId }),
  );
  app.use(errorHandler);
  return app;
}

function sessionCookie(token) {
  return `${TEST_COOKIE}=${token}`;
}

test('protected middleware rejects missing, malformed, expired, tampered, and invalid-user sessions', async () => {
  const app = createProtectedTestApp();
  const validToken = signAccessToken(TEST_USER_ID, TEST_SECRET);
  const expiredToken = jwt.sign({ type: 'access' }, TEST_SECRET, {
    algorithm: 'HS256',
    audience: 'nutrilens-web',
    expiresIn: -1,
    issuer: 'nutrilens-api',
    subject: TEST_USER_ID,
  });
  const tamperedToken = `${validToken.slice(0, -1)}${validToken.endsWith('a') ? 'b' : 'a'}`;

  await request(app).get('/protected').expect(401);
  await request(app).get('/protected').set('Cookie', sessionCookie('malformed')).expect(401);
  await request(app).get('/protected').set('Cookie', sessionCookie(expiredToken)).expect(401);
  await request(app).get('/protected').set('Cookie', sessionCookie(tamperedToken)).expect(401);
  await request(createProtectedTestApp({ findUser: async () => null }))
    .get('/protected')
    .set('Cookie', sessionCookie(validToken))
    .expect(401);

  const response = await request(app)
    .get('/protected')
    .set('Cookie', sessionCookie(validToken))
    .expect(200);
  assert.equal(response.body.userId, TEST_USER_ID);
});

test('CORS, browser-origin, and baseline security headers are enforced', async () => {
  const allowed = await request(createApp())
    .get('/api/health')
    .set('Origin', 'http://localhost:5173')
    .expect(200);
  assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(allowed.headers['access-control-allow-credentials'], 'true');
  assert.equal(allowed.headers['x-powered-by'], undefined);
  assert.equal(allowed.headers['x-content-type-options'], 'nosniff');

  const disallowed = await request(createApp())
    .get('/api/health')
    .set('Origin', 'https://malicious.example')
    .expect(200);
  assert.notEqual(disallowed.headers['access-control-allow-origin'], 'https://malicious.example');

  const crossSite = await request(createApp())
    .post('/api/auth/login')
    .set('Sec-Fetch-Site', 'cross-site')
    .send({ email: 'person@example.com', password: 'valid-password' })
    .expect(403);
  assert.equal(crossSite.body.error.code, 'ORIGIN_REJECTED');

  const crossOriginRecipe = await request(createApp())
    .post('/api/recipes/recommend')
    .set('Origin', 'https://malicious.example')
    .send({ ingredients: [{ name: 'rice' }] })
    .expect(403);
  assert.equal(crossOriginRecipe.body.error.code, 'ORIGIN_REJECTED');
});

test('request and unexpected-error logs exclude query, cookie, body, and error secrets', async () => {
  const requestLogs = [];
  const errorLogs = [];
  const querySecret = 'private-query-token';
  const cookieSecret = 'private-session-cookie';
  const bodySecret = 'private-request-body';
  const errorSecret = 'private-provider-error';
  const app = express();

  app.use(createRequestLogger({ logger: { info: (entry) => requestLogs.push(entry) } }));
  app.use(express.json());
  app.post('/failure', (_request, _response, next) => {
    next(Object.assign(new Error(errorSecret), { code: errorSecret }));
  });
  app.use(createErrorHandler({ logger: { error: (...entry) => errorLogs.push(entry) } }));

  const response = await request(app)
    .post(`/failure?token=${querySecret}`)
    .set('Cookie', `session=${cookieSecret}`)
    .send({ prompt: bodySecret })
    .expect(500);

  const serializedLogs = JSON.stringify({ requestLogs, errorLogs });
  assert.equal(serializedLogs.includes(querySecret), false);
  assert.equal(serializedLogs.includes(cookieSecret), false);
  assert.equal(serializedLogs.includes(bodySecret), false);
  assert.equal(serializedLogs.includes(errorSecret), false);
  assert.equal(JSON.stringify(response.body).includes(errorSecret), false);
  assert.equal(JSON.parse(requestLogs[0]).path, '/failure');
  assert.equal(response.body.error.code, 'INTERNAL_SERVER_ERROR');
  assert.equal(typeof response.body.meta.requestId, 'string');
});

test('malformed and oversized JSON receive sanitized client errors', async () => {
  const malformed = await request(createApp())
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:5173')
    .set('Content-Type', 'application/json')
    .send('{"email":')
    .expect(400);
  assert.equal(malformed.body.error.code, 'INVALID_JSON');
  assert.equal(malformed.body.error.message.includes('Unexpected token'), false);

  const oversized = await request(createApp())
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:5173')
    .send({ email: 'person@example.com', password: 'x'.repeat(110_000) })
    .expect(413);
  assert.equal(oversized.body.error.code, 'REQUEST_TOO_LARGE');
});

test('authentication rate limits return a stable error after the configured threshold', async () => {
  const app = express();
  app.post('/login', createAuthRateLimit({ limit: 2, windowMs: 60_000 }), (_req, res) => {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS' } });
  });

  await request(app).post('/login').expect(401);
  await request(app).post('/login').expect(401);
  const limited = await request(app).post('/login').expect(429);

  assert.equal(limited.body.error.code, 'AUTH_RATE_LIMITED');
  assert.match(limited.headers['ratelimit-policy'], /2/);
});

test('duplicate accounts are rejected and password hashes stay outside public users', async () => {
  const originalExists = User.exists;
  User.exists = async () => ({ _id: new mongoose.Types.ObjectId() });

  try {
    await assert.rejects(
      registerUser({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'a-secure-test-password',
      }),
      (error) => error.statusCode === 409 && error.code === 'ACCOUNT_EXISTS',
    );
  } finally {
    User.exists = originalExists;
  }

  const publicUser = toPublicUser({
    _id: new mongoose.Types.ObjectId(),
    name: 'Private User',
    email: 'private@example.com',
    passwordHash: 'never-return-this',
    createdAt: new Date('2026-08-27T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
  assert.equal(publicUser.passwordHash, undefined);
  assert.equal(JSON.stringify(publicUser).includes('never-return-this'), false);
});
