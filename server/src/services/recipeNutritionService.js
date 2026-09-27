import { NUTRITION_ASSUMPTION_CODES } from '../config/recipes.js';
import { bundledNutritionProvider } from '../providers/nutrition/bundledNutritionProvider.js';
import { assertNutritionProvider } from '../providers/nutrition/nutritionProvider.js';

const nutrientPrecision = Object.freeze({
  calories: 1,
  protein: 2,
  carbohydrates: 2,
  fat: 2,
  fiber: 2,
});

function emptyNutrition() {
  return Object.fromEntries(Object.keys(nutrientPrecision).map((nutrient) => [nutrient, 0]));
}

function roundNutrition(nutrition) {
  return Object.fromEntries(
    Object.entries(nutrientPrecision).map(([nutrient, precision]) => [
      nutrient,
      Number(nutrition[nutrient].toFixed(precision)),
    ]),
  );
}

function confidenceLevel(score) {
  if (score >= 90) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

function nutritionAssumption({ ingredient, code, message }) {
  if (!NUTRITION_ASSUMPTION_CODES.includes(code)) {
    throw new TypeError(`Unsupported nutrition assumption code: ${code}.`);
  }
  return { ingredient, code, message };
}

export function estimateRecipeNutrition(
  { ingredients, servings },
  { provider = bundledNutritionProvider } = {},
) {
  const nutritionProvider = assertNutritionProvider(provider);
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    throw new TypeError('Recipe nutrition requires at least one ingredient.');
  }
  if (!Number.isInteger(servings) || servings <= 0) {
    throw new TypeError('Recipe servings must be a positive integer.');
  }

  const totalNutritionRaw = emptyNutrition();
  const unmatchedIngredients = new Set();
  const assumptions = [];
  const ingredientEstimates = [];
  let requiredIngredientCount = 0;
  let matchedIngredientCount = 0;
  let confidenceTotal = 0;
  let excludedOptionalCount = 0;

  for (const ingredient of ingredients) {
    if (ingredient.optional) {
      excludedOptionalCount += 1;
      const assumption = nutritionAssumption({
        ingredient: ingredient.name,
        code: 'optional_ingredient_excluded',
        message: 'Optional ingredient was excluded from the nutrition estimate.',
      });
      assumptions.push(assumption);
      ingredientEstimates.push({ status: 'excluded_optional', name: ingredient.name });
      continue;
    }

    requiredIngredientCount += 1;
    const estimate = nutritionProvider.estimateIngredient(ingredient);
    ingredientEstimates.push(estimate);

    if (estimate.status !== 'matched') {
      unmatchedIngredients.add(ingredient.name);
      assumptions.push(
        nutritionAssumption({
          ingredient: ingredient.name,
          code: estimate.reason,
          message:
            estimate.reason === 'unknown_ingredient'
              ? 'Ingredient is not available in the bundled nutrition dataset.'
              : 'The supplied unit cannot be converted safely for this ingredient.',
        }),
      );
      continue;
    }

    matchedIngredientCount += 1;
    confidenceTotal += estimate.confidenceScore;
    for (const nutrient of Object.keys(nutrientPrecision)) {
      totalNutritionRaw[nutrient] += estimate.nutrition[nutrient];
    }
    assumptions.push(
      ...estimate.assumptions.map((assumption) =>
        nutritionAssumption({ ingredient: ingredient.name, ...assumption }),
      ),
    );
  }

  const coveragePercent =
    requiredIngredientCount === 0
      ? 0
      : Math.round((matchedIngredientCount / requiredIngredientCount) * 100);
  const baseConfidence =
    requiredIngredientCount === 0 ? 0 : confidenceTotal / requiredIngredientCount;
  const optionalPenalty = Math.min(15, excludedOptionalCount * 3);
  const confidenceScore = Math.max(0, Math.round(baseConfidence - optionalPenalty));
  const totalNutrition = roundNutrition(totalNutritionRaw);
  const perServingNutrition = roundNutrition(
    Object.fromEntries(
      Object.entries(totalNutritionRaw).map(([nutrient, value]) => [nutrient, value / servings]),
    ),
  );

  return {
    totalNutrition,
    nutritionPerServing: {
      ...perServingNutrition,
      estimated: true,
      provider: nutritionProvider.name,
      coveragePercent,
      unmatchedIngredients: [...unmatchedIngredients],
      confidence: {
        score: confidenceScore,
        level: confidenceLevel(confidenceScore),
      },
      provenance: { ...nutritionProvider.provenance },
      assumptions,
    },
    ingredientEstimates,
  };
}
