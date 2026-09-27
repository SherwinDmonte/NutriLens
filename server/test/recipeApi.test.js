import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createRecipeRateLimit } from '../src/middleware/recipeRateLimit.js';
import { requestLogger } from '../src/middleware/requestLogger.js';
import { bundledRecipeProvider } from '../src/providers/recipes/bundledRecipeProvider.js';
import { createRecipeRouter } from '../src/routes/recipeRoutes.js';
import { getRecipeRecommendations } from '../src/services/recipeRecommendationService.js';
import { getSessionCookieName } from '../src/services/tokenService.js';
import { recipeRecommendationResponseSchema } from '../src/validators/recipeRecommendationValidators.js';
import {
  calorieLimitedRequestFixture,
  eggetarianRequestFixture,
  highProteinRequestFixture,
  ingredientOnlyRequestFixture,
  timeLimitedRequestFixture,
  veganRequestFixture,
  vegetarianRequestFixture,
} from '../test-support/recipeRecommendationFixtures.js';

const authenticatedUserId = new mongoose.Types.ObjectId().toString();
const noRateLimit = (_request, _response, next) => next();

function createRecipeTestApp({
  recommend = getRecipeRecommendations,
  rateLimiter = noRateLimit,
} = {}) {
  const app = express();
  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));
  app.use(
    '/api/recipes',
    createRecipeRouter({
      authenticate: (request_, _response, next) => {
        request_.auth = { userId: authenticatedUserId };
        next();
      },
      rateLimiter,
      recommend,
    }),
  );
  app.use(errorHandler);
  return app;
}

test('protected recommendation API returns validated results for every required scenario', async () => {
  const providerInputs = [];
  const logs = [];
  const provider = {
    name: 'bundled',
    generateRecipes: async (input) => {
      providerInputs.push(input);
      return bundledRecipeProvider.generateRecipes(input);
    },
  };
  const recommend = (input) =>
    getRecipeRecommendations(input, {
      provider,
      logger: { info: (event) => logs.push(JSON.parse(event)) },
    });
  const app = createRecipeTestApp({ recommend });
  const scenarios = [
    ingredientOnlyRequestFixture,
    vegetarianRequestFixture,
    eggetarianRequestFixture,
    veganRequestFixture,
    highProteinRequestFixture,
    calorieLimitedRequestFixture,
    timeLimitedRequestFixture,
  ];

  for (const scenario of scenarios) {
    const response = await request(app).post('/api/recipes/recommend').send(scenario).expect(200);
    assert.equal(recipeRecommendationResponseSchema.safeParse(response.body).success, true);
    assert.equal(['ok', 'partial'].includes(response.body.data.status), true);
    assert.equal(response.body.data.recipes.length >= 1, true);
    assert.equal(response.body.data.recipes.length <= (scenario.resultCount || 4), true);
    assert.deepEqual(response.body.data.provider, {
      requested: 'bundled',
      used: 'bundled',
      fallbackUsed: false,
      fallbackReason: null,
    });
    assert.equal(response.body.meta.contractVersion, '2');
    assert.equal(JSON.stringify(response.body).includes(authenticatedUserId), false);
  }

  assert.equal(providerInputs.length, scenarios.length);
  assert.equal(
    providerInputs.every((input) => input.userId === undefined),
    true,
  );
  assert.equal(
    providerInputs.every((input) => input.authenticatedUserId === undefined),
    true,
  );
  assert.equal(
    providerInputs.every((input) => input.signal instanceof AbortSignal),
    true,
  );
  assert.equal(logs.length, scenarios.length);
  assert.equal(
    logs.every((entry) => entry.type === 'recipe_recommendation'),
    true,
  );
  assert.equal(
    logs.every((entry) => entry.ingredients === undefined),
    true,
  );
});

test('recommendation endpoint rejects missing and tampered sessions before provider work', async () => {
  const missing = await request(createApp())
    .post('/api/recipes/recommend')
    .set('Origin', 'http://localhost:5173')
    .send(ingredientOnlyRequestFixture)
    .expect(401);
  const tampered = await request(createApp())
    .post('/api/recipes/recommend')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', `${getSessionCookieName()}=tampered-token`)
    .send(ingredientOnlyRequestFixture)
    .expect(401);

  assert.equal(missing.body.error.code, 'AUTHENTICATION_REQUIRED');
  assert.equal(tampered.body.error.code, 'INVALID_SESSION');
});

test('validation rejects ownership injection and invalid requests before orchestration', async () => {
  let orchestrationCalls = 0;
  const app = createRecipeTestApp({
    recommend: async () => {
      orchestrationCalls += 1;
      throw new Error('Orchestration must not be called.');
    },
  });

  const ownershipInjection = await request(app)
    .post('/api/recipes/recommend')
    .send({ ...ingredientOnlyRequestFixture, userId: authenticatedUserId })
    .expect(400);
  const invalidInput = await request(app)
    .post('/api/recipes/recommend')
    .send({ ingredients: [] })
    .expect(400);

  assert.equal(ownershipInjection.body.error.code, 'VALIDATION_ERROR');
  assert.equal(invalidInput.body.error.code, 'VALIDATION_ERROR');
  assert.equal(orchestrationCalls, 0);
});

test('adversarial recipe payloads are rejected before provider orchestration', async () => {
  let orchestrationCalls = 0;
  const app = createRecipeTestApp({
    recommend: async () => {
      orchestrationCalls += 1;
      throw new Error('Orchestration must not be called.');
    },
  });

  const unsafeMarkup = '<img src=x onerror=alert(1)>';
  const invalidPayloads = [
    { ingredients: [{ name: unsafeMarkup }] },
    { ingredients: [{ name: 'rice', quantity: Number.MAX_VALUE, unit: 'grams' }] },
    { ingredients: [{ name: 'rice' }], maxCaloriesPerServing: Number.MAX_SAFE_INTEGER },
    { ingredients: [{ name: 'rice' }], auth: { userId: authenticatedUserId } },
    { ingredients: [{ name: 'rice' }], authenticatedUserId },
  ];

  for (const payload of invalidPayloads) {
    const response = await request(app).post('/api/recipes/recommend').send(payload).expect(400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    assert.equal(JSON.stringify(response.body).includes(unsafeMarkup), false);
  }

  const prototypePayload = await request(app)
    .post('/api/recipes/recommend')
    .set('Content-Type', 'application/json')
    .send(`{"ingredients":[{"name":"rice"}],"__proto__":{"userId":"${authenticatedUserId}"}}`)
    .expect(400);
  assert.equal(prototypePayload.body.error.code, 'VALIDATION_ERROR');
  assert.equal(Object.prototype.userId, undefined);

  const oversized = await request(app)
    .post('/api/recipes/recommend')
    .send({ ingredients: [{ name: 'x'.repeat(110_000) }] })
    .expect(413);
  assert.equal(oversized.body.error.code, 'REQUEST_TOO_LARGE');
  assert.equal(orchestrationCalls, 0);
});

test('no matching recipe is a stable successful response rather than a provider error', async () => {
  const response = await request(createRecipeTestApp())
    .post('/api/recipes/recommend')
    .send({ ingredients: [{ name: 'moon fruit' }] })
    .expect(200);

  assert.equal(response.body.data.status, 'no_match');
  assert.deepEqual(response.body.data.recipes, []);
  assert.equal(response.body.data.provider.used, 'bundled');
  assert.equal(recipeRecommendationResponseSchema.safeParse(response.body).success, true);
});

test('API responses never relax explicit calorie and cooking-time limits', async () => {
  const calorieResponse = await request(createRecipeTestApp())
    .post('/api/recipes/recommend')
    .send({ ...calorieLimitedRequestFixture, maxCaloriesPerServing: 200 })
    .expect(200);
  const timeResponse = await request(createRecipeTestApp())
    .post('/api/recipes/recommend')
    .send(timeLimitedRequestFixture)
    .expect(200);

  assert.equal(
    calorieResponse.body.data.recipes.every((recipe) => recipe.nutritionPerServing.calories <= 200),
    true,
  );
  assert.equal(
    timeResponse.body.data.recipes.every(
      (recipe) => recipe.time.totalMinutes <= timeLimitedRequestFixture.maxTotalTimeMinutes,
    ),
    true,
  );
});

test('provider unavailability and malformed output return one sanitized stable error', async () => {
  const secretProviderMessage = 'private-provider-token-and-prompt';
  const unavailableProvider = {
    name: 'bundled',
    generateRecipes: async () => {
      throw new Error(secretProviderMessage);
    },
  };
  const malformedProvider = {
    name: 'bundled',
    generateRecipes: async () => ({ recipes: [{ title: 'Incomplete private output' }] }),
  };
  const unavailableApp = createRecipeTestApp({
    recommend: (input) => getRecipeRecommendations(input, { provider: unavailableProvider }),
  });
  const malformedApp = createRecipeTestApp({
    recommend: (input) => getRecipeRecommendations(input, { provider: malformedProvider }),
  });

  const unavailable = await request(unavailableApp)
    .post('/api/recipes/recommend')
    .send(ingredientOnlyRequestFixture)
    .expect(503);
  const malformed = await request(malformedApp)
    .post('/api/recipes/recommend')
    .send(ingredientOnlyRequestFixture)
    .expect(503);

  for (const response of [unavailable, malformed]) {
    assert.deepEqual(response.body.error, {
      code: 'RECIPE_PROVIDER_UNAVAILABLE',
      message: 'Recipe recommendations are temporarily unavailable. Please try again.',
    });
    assert.equal(JSON.stringify(response.body).includes(secretProviderMessage), false);
    assert.equal(JSON.stringify(response.body).includes('Incomplete private output'), false);
  }
});

test('provider deadlines and caller cancellation abort work with sanitized failures', async () => {
  const observedSignals = [];
  const hangingProvider = {
    name: 'bundled',
    generateRecipes: ({ signal }) => {
      observedSignals.push(signal);
      return new Promise(() => {});
    },
  };
  const logs = [];
  const timedRecommend = (input) =>
    getRecipeRecommendations(input, {
      provider: hangingProvider,
      timeoutMs: 15,
      logger: { info: (event) => logs.push(JSON.parse(event)) },
    });
  const timedResponse = await request(createRecipeTestApp({ recommend: timedRecommend }))
    .post('/api/recipes/recommend')
    .send(ingredientOnlyRequestFixture)
    .expect(503);

  assert.equal(timedResponse.body.error.code, 'RECIPE_PROVIDER_UNAVAILABLE');
  assert.equal(observedSignals[0].aborted, true);
  assert.equal(logs[0].failureKind, 'timeout');

  const callerController = new AbortController();
  const cancelled = getRecipeRecommendations(
    {
      authenticatedUserId,
      input: ingredientOnlyRequestFixture,
      requestId: 'cancel-test',
      signal: callerController.signal,
    },
    { provider: hangingProvider, timeoutMs: 5_000, logger: { info: () => {} } },
  );
  callerController.abort();
  await assert.rejects(
    cancelled,
    (error) => error.statusCode === 503 && error.code === 'RECIPE_PROVIDER_UNAVAILABLE',
  );
  assert.equal(observedSignals[1].aborted, true);
});

test('recommendation rate limiting is scoped after authentication and returns stable metadata', async () => {
  const limiter = createRecipeRateLimit({ limit: 2, windowMs: 60_000 });
  const app = createRecipeTestApp({ rateLimiter: limiter });

  await request(app).post('/api/recipes/recommend').send(ingredientOnlyRequestFixture).expect(200);
  await request(app).post('/api/recipes/recommend').send(ingredientOnlyRequestFixture).expect(200);
  const limited = await request(app)
    .post('/api/recipes/recommend')
    .send(ingredientOnlyRequestFixture)
    .expect(429);

  assert.equal(limited.body.error.code, 'RECOMMENDATION_RATE_LIMITED');
  assert.equal(typeof limited.body.meta.requestId, 'string');
  assert.match(limited.headers['ratelimit-policy'], /2/);
});
