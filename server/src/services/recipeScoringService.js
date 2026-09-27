import { createHash } from 'node:crypto';

import {
  BUNDLED_RECIPE_LIMITS,
  RECIPE_SCORING_TARGETS,
  RECIPE_SCORING_WEIGHTS,
} from '../config/recipes.js';
import { estimateRecipeNutrition } from './recipeNutritionService.js';
import { createUnavailableRecipeImage } from './recipeImageService.js';
import {
  enrichedRecipeSchema,
  providerRecipeBatchSchema,
  recipeRecommendationRequestSchema,
} from '../validators/recipeRecommendationValidators.js';
import {
  deriveDietaryTags,
  getBundledIngredientIdentity,
  satisfiesDietaryPreference,
} from '../utils/recipeDietary.js';

const pantryIngredientIds = new Set([
  'garlic-raw',
  'ginger-raw',
  'olive-oil',
  'lemon-juice',
  'black-pepper',
  'cumin-ground',
  'turmeric-ground',
  'table-salt',
  'water',
]);

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function roundedScore(value) {
  return Math.round(clampScore(value));
}

function balancedCalorieScore(calories) {
  const { minimum, maximum } = RECIPE_SCORING_TARGETS.balancedCalories;
  if (calories < minimum) return roundedScore((calories / minimum) * 100);
  if (calories <= maximum) return 100;
  return roundedScore(100 - ((calories - maximum) / maximum) * 100);
}

export function calculateGoalFit(goal, nutrition) {
  if (goal === 'high-protein') {
    return roundedScore((nutrition.protein / RECIPE_SCORING_TARGETS.highProteinGrams) * 100);
  }
  if (goal === 'high-fiber') {
    return roundedScore((nutrition.fiber / RECIPE_SCORING_TARGETS.highFiberGrams) * 100);
  }
  if (goal === 'lower-calorie') {
    const { fullScoreAtOrBelow, zeroScoreAtOrAbove } = RECIPE_SCORING_TARGETS.lowerCalorie;
    if (nutrition.calories <= fullScoreAtOrBelow) return 100;
    if (nutrition.calories >= zeroScoreAtOrAbove) return 0;
    return roundedScore(
      ((zeroScoreAtOrAbove - nutrition.calories) / (zeroScoreAtOrAbove - fullScoreAtOrBelow)) * 100,
    );
  }

  const proteinScore = roundedScore(
    (nutrition.protein / RECIPE_SCORING_TARGETS.balancedProteinGrams) * 100,
  );
  const fiberScore = roundedScore(
    (nutrition.fiber / RECIPE_SCORING_TARGETS.balancedFiberGrams) * 100,
  );
  return roundedScore((proteinScore + fiberScore + balancedCalorieScore(nutrition.calories)) / 3);
}

function explicitLimitFit(value, limit) {
  if (limit === undefined) return 100;
  return roundedScore(((limit - value) / limit) * 100);
}

export function calculateRecipeScore(components) {
  return roundedScore(
    Object.entries(RECIPE_SCORING_WEIGHTS).reduce(
      (total, [component, weight]) => total + components[component] * weight,
      0,
    ),
  );
}

function ingredientKey(name) {
  return getBundledIngredientIdentity(name) || name.trim().toLocaleLowerCase('en-US');
}

function splitRecipeIngredients(recipeIngredients, requestIngredients) {
  const requestByKey = new Map(
    requestIngredients.map((ingredient) => [ingredientKey(ingredient.name), ingredient.name]),
  );
  const available = [];
  const additional = [];

  for (const ingredient of recipeIngredients) {
    const matchedInputName = requestByKey.get(ingredientKey(ingredient.name));
    if (matchedInputName) {
      available.push({ ...ingredient, matchedInputName });
    } else {
      additional.push({ ...ingredient });
    }
  }

  return { available, additional };
}

function calculateIngredientFit(recipeIngredients, availableIngredients) {
  const coreIngredientKeys = recipeIngredients
    .filter(
      (ingredient) =>
        !ingredient.optional &&
        !pantryIngredientIds.has(getBundledIngredientIdentity(ingredient.name)),
    )
    .map((ingredient) => ingredientKey(ingredient.name));
  if (coreIngredientKeys.length === 0) return { score: 0, matched: 0, total: 0 };

  const availableKeys = new Set(
    availableIngredients.map((ingredient) => ingredientKey(ingredient.name)),
  );
  const matched = coreIngredientKeys.filter((key) => availableKeys.has(key)).length;
  return {
    score: roundedScore((matched / coreIngredientKeys.length) * 100),
    matched,
    total: coreIngredientKeys.length,
  };
}

function recommendationReason({ goal, ingredientFit, nutrition }) {
  const prefix = `Uses ${ingredientFit.matched} of ${ingredientFit.total} core recipe ingredients from your list`;
  if (goal === 'high-protein') {
    return `${prefix} and provides an estimated ${nutrition.protein.toFixed(1)} g protein per serving.`;
  }
  if (goal === 'high-fiber') {
    return `${prefix} and provides an estimated ${nutrition.fiber.toFixed(1)} g fiber per serving.`;
  }
  if (goal === 'lower-calorie') {
    return `${prefix} at an estimated ${nutrition.calories.toFixed(1)} calories per serving.`;
  }
  return `${prefix}, with an estimated ${nutrition.calories.toFixed(1)} calories, ${nutrition.protein.toFixed(1)} g protein, and ${nutrition.fiber.toFixed(1)} g fiber per serving.`;
}

function stableRecipeId(recipe, providerName) {
  const fingerprint = JSON.stringify({
    title: recipe.title,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
  });
  return `${providerName}-${createHash('sha256').update(fingerprint).digest('hex').slice(0, 16)}`;
}

function meetsHardConstraints(recipe, nutrition, dietaryTags, request) {
  if (!satisfiesDietaryPreference(recipe.ingredients, request.dietaryPreference)) return false;
  if (request.dietaryPreference !== 'none' && !dietaryTags.includes(request.dietaryPreference)) {
    return false;
  }
  if (request.mealType !== 'any' && !recipe.mealTypes.includes(request.mealType)) return false;

  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  if (request.maxTotalTimeMinutes !== undefined && totalMinutes > request.maxTotalTimeMinutes) {
    return false;
  }
  if (request.maxCaloriesPerServing !== undefined) {
    if (nutrition.coveragePercent < 100) return false;
    if (nutrition.calories > request.maxCaloriesPerServing) return false;
  }
  return true;
}

function enrichAndScoreRecipe(recipe, request, providerName) {
  const nutritionResult = estimateRecipeNutrition({
    ingredients: recipe.ingredients,
    servings: recipe.servings,
  });
  const nutrition = nutritionResult.nutritionPerServing;
  const dietaryTags = deriveDietaryTags(recipe.ingredients);
  if (!meetsHardConstraints(recipe, nutrition, dietaryTags, request)) return null;

  const ingredients = splitRecipeIngredients(recipe.ingredients, request.ingredients);
  if (ingredients.additional.length > BUNDLED_RECIPE_LIMITS.maximumAdditionalIngredients) {
    return null;
  }

  const ingredientFit = calculateIngredientFit(recipe.ingredients, ingredients.available);
  const totalMinutes = recipe.prepMinutes + recipe.cookMinutes;
  const components = {
    ingredient: ingredientFit.score,
    goal: calculateGoalFit(request.goal, nutrition),
    diet: 100,
    calories: explicitLimitFit(nutrition.calories, request.maxCaloriesPerServing),
    time: explicitLimitFit(totalMinutes, request.maxTotalTimeMinutes),
  };

  const imageRecipe = {
    ...recipe,
    ingredients,
    steps: recipe.steps.map((instruction, index) => ({ number: index + 1, instruction })),
  };

  return enrichedRecipeSchema.parse({
    id: stableRecipeId(recipe, providerName),
    title: recipe.title,
    summary: recipe.summary,
    servings: recipe.servings,
    time: {
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      totalMinutes,
    },
    difficulty: recipe.difficulty,
    mealTypes: recipe.mealTypes,
    dietaryTags,
    image: createUnavailableRecipeImage(imageRecipe),
    ingredients,
    steps: imageRecipe.steps,
    nutritionPerServing: nutrition,
    match: {
      score: calculateRecipeScore(components),
      components,
      reason: recommendationReason({ goal: request.goal, ingredientFit, nutrition }),
    },
    source: providerName,
  });
}

function compareRankedRecipes(left, right) {
  return (
    right.match.score - left.match.score ||
    right.match.components.ingredient - left.match.components.ingredient ||
    left.ingredients.additional.length - right.ingredients.additional.length ||
    left.time.totalMinutes - right.time.totalMinutes ||
    left.title.localeCompare(right.title, 'en-US')
  );
}

export function scoreAndRankRecipeCandidates({
  request,
  providerOutput,
  providerName = 'bundled',
}) {
  const normalizedRequest = recipeRecommendationRequestSchema.parse(request);
  const validatedOutput = providerRecipeBatchSchema.parse(providerOutput);
  const rankedRecipes = validatedOutput.recipes
    .map((recipe) => enrichAndScoreRecipe(recipe, normalizedRequest, providerName))
    .filter(Boolean)
    .sort(compareRankedRecipes)
    .slice(0, normalizedRequest.resultCount);

  return {
    status:
      rankedRecipes.length === 0
        ? 'no_match'
        : rankedRecipes.length < normalizedRequest.resultCount
          ? 'partial'
          : 'ok',
    recipes: rankedRecipes,
  };
}
