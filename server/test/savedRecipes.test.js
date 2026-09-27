import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { SavedRecipe } from '../src/models/index.js';
import { createRecipeRouter } from '../src/routes/recipeRoutes.js';
import {
  createRecipeFingerprint,
  getSavedRecipe,
  listSavedRecipes,
  removeSavedRecipe,
  saveRecipe,
} from '../src/services/savedRecipeService.js';
import { AppError } from '../src/utils/AppError.js';
import { saveRecipeSchema } from '../src/validators/savedRecipeValidators.js';
import {
  enrichedRecipeFixture,
  recommendationResponseFixture,
} from '../test-support/recipeRecommendationFixtures.js';

const ownerA = new mongoose.Types.ObjectId().toString();
const ownerB = new mongoose.Types.ObjectId().toString();
const savedRecipeId = new mongoose.Types.ObjectId().toString();
const otherSavedRecipeId = new mongoose.Types.ObjectId().toString();
const provider = recommendationResponseFixture.data.provider;
const validInput = Object.freeze({ recipe: enrichedRecipeFixture, provider });

function rawSavedRecipe(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(savedRecipeId),
    userId: new mongoose.Types.ObjectId(ownerA),
    fingerprint: createRecipeFingerprint(enrichedRecipeFixture),
    snapshot: structuredClone(enrichedRecipeFixture),
    provider: structuredClone(provider),
    createdAt: new Date('2026-09-26T10:00:00.000Z'),
    updatedAt: new Date('2026-09-26T10:00:00.000Z'),
    ...overrides,
  };
}

test('SavedRecipe validates immutable snapshots and defines owner-safe indexes', async () => {
  const savedRecipe = new SavedRecipe(rawSavedRecipe());
  await savedRecipe.validate();

  assert.equal(savedRecipe.userId.toString(), ownerA);
  assert.equal(savedRecipe.snapshot.title, enrichedRecipeFixture.title);
  assert.equal(SavedRecipe.schema.path('userId').options.immutable, true);
  assert.equal(SavedRecipe.schema.path('snapshot').options.immutable, true);

  const indexes = SavedRecipe.schema.indexes();
  const uniqueIndex = indexes.find(
    ([, options]) => options.name === 'savedrecipes_unique_owner_fingerprint',
  );
  assert.deepEqual(uniqueIndex[0], { userId: 1, fingerprint: 1 });
  assert.equal(uniqueIndex[1].unique, true);
  assert.ok(indexes.some(([, options]) => options.name === 'savedrecipes_owned_recent'));
});

test('SavedRecipe rejects unvalidated snapshots and provenance', async () => {
  const savedRecipe = new SavedRecipe({
    ...rawSavedRecipe(),
    snapshot: { title: 'Incomplete snapshot' },
    provider: { requested: 'gemini' },
  });

  await assert.rejects(savedRecipe.validate(), (error) => {
    assert.ok(error.errors.snapshot);
    assert.ok(error.errors.provider);
    return true;
  });
});

test('saved-recipe fingerprints are normalized and independent of score or generated ID', () => {
  const changedPresentation = {
    ...enrichedRecipeFixture,
    id: 'different-generated-id',
    match: {
      ...enrichedRecipeFixture.match,
      score: 42,
      reason: 'A different request produced a different ranking explanation.',
    },
  };
  const changedIngredients = {
    ...enrichedRecipeFixture,
    ingredients: {
      ...enrichedRecipeFixture.ingredients,
      additional: [
        ...enrichedRecipeFixture.ingredients.additional,
        { name: 'garlic', quantity: 1, unit: 'piece', optional: false },
      ],
    },
  };

  assert.equal(
    createRecipeFingerprint(enrichedRecipeFixture),
    createRecipeFingerprint(changedPresentation),
  );
  assert.notEqual(
    createRecipeFingerprint(enrichedRecipeFixture),
    createRecipeFingerprint(changedIngredients),
  );
});

test('save uses authenticated ownership, stores only the validated snapshot, and handles duplicates', async () => {
  let createdData;
  const repository = {
    findOwnedSavedRecipeByFingerprint: async () => null,
    createSavedRecipe: async (data) => {
      createdData = data;
      return rawSavedRecipe({ ...data, _id: new mongoose.Types.ObjectId(savedRecipeId) });
    },
  };
  const input = { ...structuredClone(validInput), userId: ownerB, fingerprint: 'forged' };
  const saved = await saveRecipe({ authenticatedUserId: ownerA, input }, { repository });

  input.recipe.title = 'Changed after the save completed';
  input.provider.used = 'bundled';

  assert.equal(createdData.userId, ownerA);
  assert.equal(createdData.snapshot.userId, undefined);
  assert.equal(createdData.provider.apiKey, undefined);
  assert.equal(createdData.snapshot.title, enrichedRecipeFixture.title);
  assert.deepEqual(createdData.provider, provider);
  assert.equal(saved.recipe.title, enrichedRecipeFixture.title);
  assert.equal(saved.id, savedRecipeId);

  const duplicateRepository = {
    findOwnedSavedRecipeByFingerprint: async () => rawSavedRecipe(),
    createSavedRecipe: async () => {
      throw new Error('must not create a duplicate');
    },
  };
  await assert.rejects(
    saveRecipe(
      { authenticatedUserId: ownerA, input: validInput },
      { repository: duplicateRepository },
    ),
    (error) => error.statusCode === 409 && error.code === 'RECIPE_ALREADY_SAVED',
  );

  const raceRepository = {
    findOwnedSavedRecipeByFingerprint: async () => null,
    createSavedRecipe: async () => {
      throw Object.assign(new Error('duplicate database detail'), { code: 11_000 });
    },
  };
  await assert.rejects(
    saveRecipe({ authenticatedUserId: ownerA, input: validInput }, { repository: raceRepository }),
    (error) => error.statusCode === 409 && error.code === 'RECIPE_ALREADY_SAVED',
  );
});

test('list, read, and delete always scope repository operations to the authenticated owner', async () => {
  const calls = [];
  const legacySnapshot = structuredClone(enrichedRecipeFixture);
  delete legacySnapshot.image;
  const legacySavedRecipe = rawSavedRecipe({ snapshot: legacySnapshot });
  const repository = {
    listOwnedSavedRecipes: async (input) => {
      calls.push(['list', input]);
      return { savedRecipes: [legacySavedRecipe], total: 1 };
    },
    findOwnedSavedRecipe: async (input) => {
      calls.push(['get', input]);
      return input.userId === ownerA ? legacySavedRecipe : null;
    },
    deleteOwnedSavedRecipe: async (input) => {
      calls.push(['delete', input]);
      return input.userId === ownerA ? rawSavedRecipe() : null;
    },
  };

  const listed = await listSavedRecipes(
    { authenticatedUserId: ownerA, page: 2, limit: 12 },
    { repository },
  );
  const read = await getSavedRecipe({ authenticatedUserId: ownerA, savedRecipeId }, { repository });
  await removeSavedRecipe({ authenticatedUserId: ownerA, savedRecipeId }, { repository });

  assert.equal(listed.pagination.total, 1);
  assert.equal(listed.savedRecipes[0].recipe.image.url, null);
  assert.equal(listed.savedRecipes[0].recipe.image.kind, 'unavailable');
  assert.equal(read.id, savedRecipeId);
  assert.equal(read.recipe.image.url, null);
  assert.equal(read.recipe.image.kind, 'unavailable');
  assert.deepEqual(calls, [
    ['list', { userId: ownerA, page: 2, limit: 12 }],
    ['get', { userId: ownerA, savedRecipeId }],
    ['delete', { userId: ownerA, savedRecipeId }],
  ]);

  await assert.rejects(
    getSavedRecipe({ authenticatedUserId: ownerB, savedRecipeId }, { repository }),
    (error) => error.statusCode === 404 && error.code === 'SAVED_RECIPE_NOT_FOUND',
  );
  await assert.rejects(
    removeSavedRecipe({ authenticatedUserId: ownerB, savedRecipeId }, { repository }),
    (error) => error.statusCode === 404 && error.code === 'SAVED_RECIPE_NOT_FOUND',
  );
});

function createSavedRecipeTestApp(overrides = {}) {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use(
    '/api/recipes',
    createRecipeRouter({
      authenticate: (request_, _response, next) => {
        request_.auth = { userId: request_.get('x-test-user') || ownerA };
        next();
      },
      rateLimiter: (_request, _response, next) => next(),
      save: async (input) => {
        calls.push(['save', input]);
        if (overrides.save) return overrides.save(input);
        return { ...rawSavedRecipe(), id: savedRecipeId, recipe: enrichedRecipeFixture };
      },
      listSaved: async (input) => {
        calls.push(['list', input]);
        if (overrides.listSaved) return overrides.listSaved(input);
        return {
          savedRecipes: [],
          pagination: { page: input.page, limit: input.limit, total: 0, totalPages: 0 },
        };
      },
      getSaved: async (input) => {
        calls.push(['get', input]);
        if (input.savedRecipeId === otherSavedRecipeId && input.authenticatedUserId !== ownerB) {
          throw new AppError(
            404,
            'SAVED_RECIPE_NOT_FOUND',
            'The requested saved recipe was not found.',
          );
        }
        return { ...rawSavedRecipe(), id: input.savedRecipeId, recipe: enrichedRecipeFixture };
      },
      removeSaved: async (input) => {
        calls.push(['delete', input]);
        if (input.savedRecipeId === otherSavedRecipeId && input.authenticatedUserId !== ownerB) {
          throw new AppError(
            404,
            'SAVED_RECIPE_NOT_FOUND',
            'The requested saved recipe was not found.',
          );
        }
      },
    }),
  );
  app.use(errorHandler);
  return { app, calls };
}

test('saved-recipe API supports explicit save, pagination, read, and delete', async () => {
  const { app, calls } = createSavedRecipeTestApp();

  const saved = await request(app).post('/api/recipes/saved').send(validInput).expect(201);
  const listed = await request(app).get('/api/recipes/saved?page=2&limit=5').expect(200);
  const read = await request(app).get(`/api/recipes/saved/${savedRecipeId}`).expect(200);
  await request(app).delete(`/api/recipes/saved/${savedRecipeId}`).expect(204);

  assert.equal(saved.body.data.savedRecipe.recipe.title, enrichedRecipeFixture.title);
  assert.equal(listed.body.meta.pagination.page, 2);
  assert.equal(read.body.data.savedRecipe.id, savedRecipeId);
  assert.equal(
    calls.every(([, input]) => input.authenticatedUserId === ownerA),
    true,
  );
});

test('saved-recipe pagination rejects extreme and unexpected query input before repository access', async () => {
  const { app, calls } = createSavedRecipeTestApp();

  const invalidQueries = [
    '/api/recipes/saved?page=0',
    '/api/recipes/saved?page=1001',
    '/api/recipes/saved?limit=51',
    `/api/recipes/saved?userId=${ownerB}`,
    '/api/recipes/saved?limit=12&constructor=prototype',
  ];

  for (const path of invalidQueries) {
    const response = await request(app).get(path).expect(400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }

  assert.equal(
    calls.some(([name]) => name === 'list'),
    false,
  );
});

test('path, query, and body manipulation cannot cross saved-recipe owners or overwrite snapshots', async () => {
  const { app, calls } = createSavedRecipeTestApp();

  await request(app)
    .post('/api/recipes/saved')
    .send({ ...validInput, userId: ownerB })
    .expect(400);
  await request(app).get(`/api/recipes/saved?userId=${ownerB}`).expect(400);
  const read = await request(app)
    .get(`/api/recipes/saved/${otherSavedRecipeId}`)
    .set('x-test-user', ownerA)
    .expect(404);
  const deleted = await request(app)
    .delete(`/api/recipes/saved/${otherSavedRecipeId}`)
    .set('x-test-user', ownerA)
    .expect(404);
  await request(app).put(`/api/recipes/saved/${savedRecipeId}`).send(validInput).expect(404);

  assert.equal(read.body.error.code, 'SAVED_RECIPE_NOT_FOUND');
  assert.equal(deleted.body.error.code, 'SAVED_RECIPE_NOT_FOUND');
  assert.equal(
    calls.some(([name]) => name === 'save'),
    false,
  );
  assert.equal(
    calls.some(([name]) => name === 'list'),
    false,
  );
  assert.equal(
    calls
      .filter(([name]) => ['get', 'delete'].includes(name))
      .every(([, input]) => input.authenticatedUserId === ownerA),
    true,
  );
});

test('saved-recipe validation rejects mismatched provider provenance and unauthenticated access', async () => {
  const parsed = saveRecipeSchema.safeParse({
    ...validInput,
    provider: { ...provider, used: 'bundled' },
  });
  assert.equal(parsed.success, false);

  const response = await request(createApp())
    .get('/api/recipes/saved')
    .set('Origin', 'http://localhost:5173')
    .expect(401);
  assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
});

test('duplicate saves use the stable recipe-specific conflict response', async () => {
  const { app } = createSavedRecipeTestApp({
    save: async () => {
      throw new AppError(
        409,
        'RECIPE_ALREADY_SAVED',
        'This recipe is already in your saved recipes.',
      );
    },
  });
  const response = await request(app).post('/api/recipes/saved').send(validInput).expect(409);
  assert.deepEqual(response.body.error, {
    code: 'RECIPE_ALREADY_SAVED',
    message: 'This recipe is already in your saved recipes.',
  });
});
