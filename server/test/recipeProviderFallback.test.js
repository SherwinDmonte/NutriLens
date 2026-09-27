import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import { RECIPE_FALLBACK_REASONS } from '../src/config/recipes.js';
import { bundledRecipeProvider } from '../src/providers/recipes/bundledRecipeProvider.js';
import { GeminiRecipeProviderError } from '../src/providers/recipes/geminiRecipeProvider.js';
import { getRecipeRecommendations } from '../src/services/recipeRecommendationService.js';
import { ingredientOnlyRequestFixture } from '../test-support/recipeRecommendationFixtures.js';

const authenticatedUserId = new mongoose.Types.ObjectId().toString();

function recommendationInput() {
  return {
    authenticatedUserId,
    input: ingredientOnlyRequestFixture,
    requestId: 'provider-fallback-test',
  };
}

test('every supported Gemini failure uses the bundled provider with honest provenance', async () => {
  for (const kind of RECIPE_FALLBACK_REASONS) {
    const geminiProvider = {
      name: 'gemini',
      generateRecipes: async () => {
        throw new GeminiRecipeProviderError(kind);
      },
    };
    const result = await getRecipeRecommendations(recommendationInput(), {
      provider: geminiProvider,
      fallbackProvider: bundledRecipeProvider,
      logger: { info: () => {} },
    });

    assert.deepEqual(result.provider, {
      requested: 'gemini',
      used: 'bundled',
      fallbackUsed: true,
      fallbackReason: kind,
    });
    assert.equal(result.recipes.length > 0, true);
    assert.equal(
      result.recipes.every((recipe) => recipe.source === 'bundled'),
      true,
    );
  }
});

test('validated Gemini output keeps Gemini provenance while nutrition stays locally bundled', async () => {
  const generated = await bundledRecipeProvider.generateRecipes(
    recipeRecommendationRequestSchemaForProvider(),
  );
  const geminiProvider = {
    name: 'gemini',
    generateRecipes: async () => generated,
  };
  const result = await getRecipeRecommendations(recommendationInput(), {
    provider: geminiProvider,
    fallbackProvider: bundledRecipeProvider,
    logger: { info: () => {} },
  });

  assert.deepEqual(result.provider, {
    requested: 'gemini',
    used: 'gemini',
    fallbackUsed: false,
    fallbackReason: null,
  });
  assert.equal(
    result.recipes.every((recipe) => recipe.source === 'gemini'),
    true,
  );
  assert.equal(
    result.recipes.every((recipe) => recipe.nutritionPerServing.provider === 'bundled'),
    true,
  );
  assert.equal(
    result.recipes.every((recipe) => recipe.id.startsWith('gemini-')),
    true,
  );
});

test('one shared image stage runs after bundled, Gemini, and fallback recipe scoring', async () => {
  const seenSources = [];
  const imageService = {
    async enrichRecipes(recipes) {
      seenSources.push(recipes.map((recipe) => recipe.source));
      return recipes;
    },
  };
  const generated = await bundledRecipeProvider.generateRecipes(
    recipeRecommendationRequestSchemaForProvider(),
  );
  const geminiProvider = { name: 'gemini', generateRecipes: async () => generated };
  const unavailableGemini = {
    name: 'gemini',
    generateRecipes: async () => {
      throw new GeminiRecipeProviderError('unavailable');
    },
  };

  await getRecipeRecommendations(recommendationInput(), {
    provider: bundledRecipeProvider,
    imageService,
    logger: { info: () => {} },
  });
  await getRecipeRecommendations(recommendationInput(), {
    provider: geminiProvider,
    fallbackProvider: bundledRecipeProvider,
    imageService,
    logger: { info: () => {} },
  });
  await getRecipeRecommendations(recommendationInput(), {
    provider: unavailableGemini,
    fallbackProvider: bundledRecipeProvider,
    imageService,
    logger: { info: () => {} },
  });

  assert.equal(seenSources.length, 3);
  assert.equal(
    seenSources[0].every((source) => source === 'bundled'),
    true,
  );
  assert.equal(
    seenSources[1].every((source) => source === 'gemini'),
    true,
  );
  assert.equal(
    seenSources[2].every((source) => source === 'bundled'),
    true,
  );
});

test('an image-stage failure never discards otherwise valid recommendations', async () => {
  const result = await getRecipeRecommendations(recommendationInput(), {
    provider: bundledRecipeProvider,
    imageService: {
      enrichRecipes: async () => {
        throw new Error('private image provider detail');
      },
    },
    logger: { info: () => {} },
  });

  assert.equal(result.recipes.length > 0, true);
  assert.equal(
    result.recipes.every((recipe) => recipe.image.kind === 'unavailable'),
    true,
  );
});

function recipeRecommendationRequestSchemaForProvider() {
  return {
    ...ingredientOnlyRequestFixture,
    dietaryPreference: 'none',
    goal: 'balanced',
    mealType: 'any',
    resultCount: 4,
  };
}

test('a Gemini deadline triggers bundled fallback without leaking the primary failure', async () => {
  const hangingGeminiProvider = {
    name: 'gemini',
    generateRecipes: () => new Promise(() => {}),
  };
  const result = await getRecipeRecommendations(recommendationInput(), {
    provider: hangingGeminiProvider,
    fallbackProvider: bundledRecipeProvider,
    timeoutMs: 10,
    fallbackTimeoutMs: 1_000,
    logger: { info: () => {} },
  });

  assert.equal(result.provider.fallbackUsed, true);
  assert.equal(result.provider.fallbackReason, 'timeout');
  assert.equal(result.provider.used, 'bundled');
});

test('a failed bundled fallback returns only the stable sanitized service error', async () => {
  const secret = 'private-gemini-response-and-key';
  const failingProvider = {
    name: 'gemini',
    generateRecipes: async () => {
      throw new Error(secret);
    },
  };
  const failingFallback = {
    name: 'bundled',
    generateRecipes: async () => {
      throw new Error('private bundled failure');
    },
  };

  await assert.rejects(
    getRecipeRecommendations(recommendationInput(), {
      provider: failingProvider,
      fallbackProvider: failingFallback,
      logger: { info: () => {} },
    }),
    (error) =>
      error.statusCode === 503 &&
      error.code === 'RECIPE_PROVIDER_UNAVAILABLE' &&
      !error.message.includes(secret),
  );
});
