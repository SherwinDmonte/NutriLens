import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRecipeImagePrompt,
  createRecipeImageService,
  createRecipeImageSignature,
  createUnavailableRecipeImage,
} from '../src/services/recipeImageService.js';
import { enrichedRecipeFixture } from '../test-support/recipeRecommendationFixtures.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);

function recipe(overrides = {}) {
  return { ...structuredClone(enrichedRecipeFixture), ...overrides };
}

function memoryStorage(initialEntries = []) {
  const images = new Map(initialEntries);
  return {
    images,
    async read(signature) {
      return images.get(signature) || null;
    },
    async write(signature, bytes) {
      images.set(signature, Buffer.from(bytes));
    },
  };
}

test('recipe image signatures use the exact normalized ingredients and preparation', () => {
  const original = recipe();
  const reordered = recipe({
    ingredients: {
      available: [...original.ingredients.available].reverse(),
      additional: [...original.ingredients.additional].reverse(),
    },
  });
  const changedIngredient = recipe({
    ingredients: {
      ...original.ingredients,
      additional: [
        ...original.ingredients.additional,
        { name: 'spinach', quantity: 80, unit: 'grams', optional: false },
      ],
    },
  });
  const changedMethod = recipe({
    steps: [{ number: 1, instruction: 'Roast every ingredient until crisp.' }],
  });

  assert.equal(createRecipeImageSignature(reordered), createRecipeImageSignature(original));
  assert.notEqual(
    createRecipeImageSignature(changedIngredient),
    createRecipeImageSignature(original),
  );
  assert.notEqual(createRecipeImageSignature(changedMethod), createRecipeImageSignature(original));
});

test('image prompts feature user ingredients, include required additions, and forbid extras', () => {
  const prompt = buildRecipeImagePrompt(recipe());

  assert.match(prompt, /userIngredientsToFeature/iu);
  assert.match(prompt, /chickpeas/iu);
  assert.match(prompt, /tomato/iu);
  assert.match(prompt, /supportingIngredients/iu);
  assert.match(prompt, /olive oil/iu);
  assert.match(prompt, /Do not add any unlisted/iu);
  assert.equal(prompt.includes('nutritionPerServing'), false);
  assert.equal(prompt.includes('match'), false);
  assert.equal(prompt.length <= 2_000, true);
});

test('disabled image generation returns an honest unavailable descriptor', async () => {
  const source = recipe();
  const service = createRecipeImageService({
    provider: null,
    storage: memoryStorage(),
    timeoutMs: 1_000,
    concurrency: 2,
  });

  const [result] = await service.enrichRecipes([source]);
  assert.deepEqual(result.image, createUnavailableRecipeImage(source));
  assert.equal(result.image.url, null);
  assert.equal(result.image.kind, 'unavailable');
});

test('generated images are cached by signature and returned through a controlled API path', async () => {
  let providerCalls = 0;
  const storage = memoryStorage();
  const provider = {
    name: 'cloudflare',
    async generateImage({ prompt }) {
      providerCalls += 1;
      assert.match(prompt, /chickpeas/iu);
      return { bytes: jpeg, mimeType: 'image/jpeg' };
    },
  };
  const service = createRecipeImageService({
    provider,
    storage,
    timeoutMs: 1_000,
    concurrency: 2,
  });
  const source = recipe();

  const [first] = await service.enrichRecipes([source, structuredClone(source)]);
  const [second] = await service.enrichRecipes([source]);
  const signature = createRecipeImageSignature(source);

  assert.equal(providerCalls, 1);
  assert.deepEqual(first.image, second.image);
  assert.deepEqual(first.image, {
    url: `/api/recipe-images/${signature}.jpg`,
    alt: `AI-generated serving of ${source.title} featuring chickpeas, tomato`,
    kind: 'generated',
    provider: 'cloudflare',
    ingredientSignature: signature,
  });
  assert.deepEqual(storage.images.get(signature), jpeg);
});

test('one failed image remains unavailable without discarding other recipe results', async () => {
  let calls = 0;
  let active = 0;
  let maximumActive = 0;
  const provider = {
    name: 'cloudflare',
    async generateImage() {
      calls += 1;
      const callNumber = calls;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (callNumber === 2) throw new Error('private provider failure');
      return { bytes: jpeg, mimeType: 'image/jpeg' };
    },
  };
  const service = createRecipeImageService({
    provider,
    storage: memoryStorage(),
    timeoutMs: 1_000,
    concurrency: 2,
  });
  const recipes = ['One', 'Two', 'Three'].map((title) => recipe({ title }));

  const results = await service.enrichRecipes(recipes);

  assert.equal(results.length, 3);
  assert.equal(results.filter(({ image }) => image.kind === 'generated').length, 2);
  assert.equal(results.filter(({ image }) => image.kind === 'unavailable').length, 1);
  assert.equal(maximumActive <= 2, true);
});
