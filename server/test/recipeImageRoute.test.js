import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';

import { errorHandler } from '../src/middleware/errorHandler.js';
import { createRecipeImageRouter } from '../src/routes/recipeImageRoutes.js';

const SIGNATURE = 'b'.repeat(64);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x4e, 0x4c, 0xff, 0xd9]);
const authenticate = (request_, _response, next) => {
  request_.auth = { userId: 'test-user' };
  next();
};

function createTestApp({ storage, authenticate: auth = authenticate } = {}) {
  const app = express();
  app.use('/api/recipe-images', createRecipeImageRouter({ authenticate: auth, storage }));
  app.use(errorHandler);
  return app;
}

test('authenticated recipe image route serves immutable JPEG bytes safely', async () => {
  const reads = [];
  const response = await request(
    createTestApp({
      storage: {
        read: async (signature) => {
          reads.push(signature);
          return JPEG_BYTES;
        },
      },
    }),
  )
    .get(`/api/recipe-images/${SIGNATURE}.jpg`)
    .expect(200);

  assert.deepEqual(reads, [SIGNATURE]);
  assert.equal(response.headers['content-type'], 'image/jpeg');
  assert.equal(response.headers['cache-control'], 'private, max-age=31536000, immutable');
  assert.equal(response.headers['cross-origin-resource-policy'], 'same-site');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.deepEqual(response.body, JPEG_BYTES);
});

test('recipe image route returns a stable 404 for a valid cache miss', async () => {
  const response = await request(createTestApp({ storage: { read: async () => null } }))
    .get(`/api/recipe-images/${SIGNATURE}.jpg`)
    .expect(404);

  assert.equal(response.body.error.code, 'RECIPE_IMAGE_NOT_FOUND');
  assert.equal(response.body.error.message, 'The requested recipe image was not found.');
});

test('recipe image route rejects an invalid signature before filesystem access', async () => {
  let reads = 0;
  const response = await request(
    createTestApp({
      storage: {
        read: async () => {
          reads += 1;
          return JPEG_BYTES;
        },
      },
    }),
  )
    .get(`/api/recipe-images/${'B'.repeat(64)}.jpg`)
    .expect(400);

  assert.equal(response.body.error.code, 'INVALID_RECIPE_IMAGE_SIGNATURE');
  assert.equal(reads, 0);
});

test('recipe image route applies authentication before cache lookup', async () => {
  let reads = 0;
  const response = await request(
    createTestApp({
      authenticate: (_request, response_, _next) =>
        response_.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED' } }),
      storage: {
        read: async () => {
          reads += 1;
          return JPEG_BYTES;
        },
      },
    }),
  )
    .get(`/api/recipe-images/${SIGNATURE}.jpg`)
    .expect(401);

  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
  assert.equal(reads, 0);
});

test('recipe image router defaults to the application authentication middleware', async () => {
  let reads = 0;
  const app = express();
  app.use(
    '/api/recipe-images',
    createRecipeImageRouter({
      storage: {
        read: async () => {
          reads += 1;
          return JPEG_BYTES;
        },
      },
    }),
  );
  app.use(errorHandler);

  const response = await request(app).get(`/api/recipe-images/${SIGNATURE}.jpg`).expect(401);

  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
  assert.equal(reads, 0);
});
