import assert from 'node:assert/strict';
import test from 'node:test';

import { BUNDLED_RECIPE_LIMITS, RECIPE_SCORING_WEIGHTS } from '../src/config/recipes.js';
import { bundledCulinaryIngredients, bundledRecipeTemplates } from '../src/data/bundledRecipes.js';
import { ingredientNutritionCatalog } from '../src/data/ingredientNutrition.js';
import { bundledRecipeProvider } from '../src/providers/recipes/bundledRecipeProvider.js';
import { assertRecipeProvider } from '../src/providers/recipes/recipeProvider.js';
import { recommendBundledRecipes } from '../src/services/bundledRecipeRecommendationService.js';
import { calculateGoalFit, calculateRecipeScore } from '../src/services/recipeScoringService.js';
import { getBundledDietClass } from '../src/utils/recipeDietary.js';
import { enrichedRecipeSchema } from '../src/validators/recipeRecommendationValidators.js';
import {
  calorieLimitedRequestFixture,
  eggetarianRequestFixture,
  highProteinRequestFixture,
  ingredientOnlyRequestFixture,
  timeLimitedRequestFixture,
  veganRequestFixture,
  vegetarianRequestFixture,
} from '../test-support/recipeRecommendationFixtures.js';

function allIngredients(recipe) {
  return [...recipe.ingredients.available, ...recipe.ingredients.additional];
}

test('bundled recipe templates are immutable and reference known nutrition ingredients', () => {
  const nutritionIds = new Set(ingredientNutritionCatalog.map((ingredient) => ingredient.id));

  assert.equal(Object.isFrozen(bundledRecipeTemplates), true);
  assert.equal(
    new Set(bundledRecipeTemplates.map((template) => template.id)).size,
    bundledRecipeTemplates.length,
  );
  for (const template of bundledRecipeTemplates) {
    assert.equal(Object.isFrozen(template), true);
    for (const slot of template.slots) {
      assert.equal(slot.maximum > 0, true);
      assert.equal(
        slot.fallbacks.every((id) => nutritionIds.has(id)),
        true,
      );
      assert.equal(
        slot.fallbacks.every((id) => Boolean(bundledCulinaryIngredients[id])),
        true,
      );
    }
    assert.equal(
      template.extras.every((extra) => nutritionIds.has(extra.id)),
      true,
    );
  }
});

test('every recognized culinary input generates safely without duplicate recipe ingredients', async () => {
  const nutritionById = new Map(
    ingredientNutritionCatalog.map((ingredient) => [ingredient.id, ingredient]),
  );

  for (const ingredientId of Object.keys(bundledCulinaryIngredients)) {
    const result = await recommendBundledRecipes({
      ingredients: [{ name: nutritionById.get(ingredientId).name }],
      resultCount: 3,
    });
    assert.equal(['ok', 'partial', 'no_match'].includes(result.status), true);
    assert.equal(
      result.recipes.every((recipe) => recipe.nutritionPerServing.coveragePercent === 100),
      true,
    );
  }
});

test('bundled provider interface is replaceable and rejects incomplete adapters', () => {
  assert.equal(assertRecipeProvider(bundledRecipeProvider), bundledRecipeProvider);
  assert.throws(() => assertRecipeProvider({ name: 'broken' }), /generateRecipes/);
});

test('ingredient-only recommendations are distinct, validated, explainable, and repeatable', async () => {
  const first = await recommendBundledRecipes(ingredientOnlyRequestFixture);
  const second = await recommendBundledRecipes(ingredientOnlyRequestFixture);

  assert.deepEqual(second, first);
  assert.equal(first.status, 'ok');
  assert.equal(first.recipes.length, 4);
  assert.equal(new Set(first.recipes.map((recipe) => recipe.title)).size, first.recipes.length);

  for (const recipe of first.recipes) {
    assert.equal(enrichedRecipeSchema.safeParse(recipe).success, true);
    assert.equal(recipe.source, 'bundled');
    assert.equal(recipe.nutritionPerServing.coveragePercent, 100);
    assert.equal(recipe.ingredients.available.length > 0, true);
    assert.equal(
      recipe.ingredients.additional.length <= BUNDLED_RECIPE_LIMITS.maximumAdditionalIngredients,
      true,
    );
    assert.match(recipe.match.reason, /^Uses \d+ of \d+ core recipe ingredients/);
  }
});

test('vegetarian hard filtering excludes egg and meat without relaxing the preference', async () => {
  const result = await recommendBundledRecipes(vegetarianRequestFixture);
  const conflictingInputResult = await recommendBundledRecipes({
    ingredients: [{ name: 'egg' }, { name: 'spinach' }],
    dietaryPreference: 'vegetarian',
  });

  assert.notEqual(result.status, 'no_match');
  assert.notEqual(conflictingInputResult.status, 'no_match');
  for (const recipe of [...result.recipes, ...conflictingInputResult.recipes]) {
    assert.equal(recipe.dietaryTags.includes('vegetarian'), true);
    assert.equal(
      allIngredients(recipe).every((ingredient) =>
        ['plant', 'dairy'].includes(getBundledDietClass(ingredient.name)),
      ),
      true,
    );
  }
});

test('eggetarian recommendations can use egg but never use meat', async () => {
  const result = await recommendBundledRecipes(eggetarianRequestFixture);

  assert.notEqual(result.status, 'no_match');
  assert.equal(
    result.recipes.some((recipe) =>
      allIngredients(recipe).some((ingredient) => getBundledDietClass(ingredient.name) === 'egg'),
    ),
    true,
  );
  for (const recipe of result.recipes) {
    assert.equal(recipe.dietaryTags.includes('eggetarian'), true);
    assert.equal(
      allIngredients(recipe).some((ingredient) => getBundledDietClass(ingredient.name) === 'meat'),
      false,
    );
  }
});

test('vegan recommendations contain only verified bundled plant ingredients', async () => {
  const result = await recommendBundledRecipes(veganRequestFixture);

  assert.notEqual(result.status, 'no_match');
  for (const recipe of result.recipes) {
    assert.equal(recipe.dietaryTags.includes('vegan'), true);
    assert.equal(
      allIngredients(recipe).every(
        (ingredient) => getBundledDietClass(ingredient.name) === 'plant',
      ),
      true,
    );
  }
});

test('goal heuristics and weighted scores use the documented reproducible formulas', async () => {
  assert.equal(calculateGoalFit('high-protein', { protein: 15 }), 50);
  assert.equal(calculateGoalFit('high-fiber', { fiber: 5 }), 50);
  assert.equal(calculateGoalFit('lower-calorie', { calories: 450 }), 50);
  assert.equal(calculateGoalFit('balanced', { calories: 300, protein: 20, fiber: 8 }), 100);
  assert.equal(
    calculateRecipeScore({ ingredient: 80, goal: 60, diet: 100, calories: 50, time: 25 }),
    70,
  );

  const result = await recommendBundledRecipes(highProteinRequestFixture);
  for (const recipe of result.recipes) {
    const reproducedScore = Math.round(
      Object.entries(RECIPE_SCORING_WEIGHTS).reduce(
        (total, [name, weight]) => total + recipe.match.components[name] * weight,
        0,
      ),
    );
    assert.equal(recipe.match.score, reproducedScore);
    assert.match(recipe.match.reason, /protein per serving/);
  }
});

test('calorie and time limits are exact hard constraints', async () => {
  const calorieResult = await recommendBundledRecipes({
    ...calorieLimitedRequestFixture,
    maxCaloriesPerServing: 200,
  });
  const timeResult = await recommendBundledRecipes(timeLimitedRequestFixture);

  assert.equal(calorieResult.status, 'partial');
  assert.equal(calorieResult.recipes.length > 0, true);
  assert.equal(
    calorieResult.recipes.every((recipe) => recipe.nutritionPerServing.calories <= 200),
    true,
  );
  assert.equal(timeResult.status, 'ok');
  assert.equal(timeResult.recipes.length, timeLimitedRequestFixture.resultCount);
  assert.equal(
    timeResult.recipes.every(
      (recipe) => recipe.time.totalMinutes <= timeLimitedRequestFixture.maxTotalTimeMinutes,
    ),
    true,
  );
});

test('combined preference filters are all enforced on every returned recipe', async () => {
  const request = {
    ...timeLimitedRequestFixture,
    goal: 'high-fiber',
    maxCaloriesPerServing: 500,
  };
  const result = await recommendBundledRecipes(request);

  assert.notEqual(result.status, 'no_match');
  assert.equal(result.recipes.length <= request.resultCount, true);
  for (const recipe of result.recipes) {
    assert.equal(recipe.dietaryTags.includes('vegan'), true);
    assert.equal(recipe.mealTypes.includes('dinner'), true);
    assert.equal(recipe.nutritionPerServing.calories <= request.maxCaloriesPerServing, true);
    assert.equal(recipe.time.totalMinutes <= request.maxTotalTimeMinutes, true);
    assert.match(recipe.match.reason, /fiber per serving/);
  }
});

test('duplicate request ingredients normalize before deterministic template generation', async () => {
  const duplicateResult = await recommendBundledRecipes({
    ingredients: [
      { name: 'chickpeas', quantity: 100, unit: 'grams' },
      { name: ' CHICKPEAS ', quantity: 100, unit: 'grams' },
      { name: 'tomato' },
    ],
  });
  const mergedResult = await recommendBundledRecipes({
    ingredients: [{ name: 'chickpeas', quantity: 200, unit: 'grams' }, { name: 'tomato' }],
  });

  assert.deepEqual(duplicateResult, mergedResult);
});

test('unsupported ingredients and deliberately impossible limits return an explicit no-match state', async () => {
  const unsupported = await recommendBundledRecipes({ ingredients: [{ name: 'moon fruit' }] });
  const impossibleLimits = await recommendBundledRecipes({
    ingredients: [{ name: 'chickpeas' }],
    maxCaloriesPerServing: 100,
    maxTotalTimeMinutes: 5,
    resultCount: 3,
  });

  assert.deepEqual(unsupported, { status: 'no_match', recipes: [] });
  assert.deepEqual(impossibleLimits, { status: 'no_match', recipes: [] });
});
