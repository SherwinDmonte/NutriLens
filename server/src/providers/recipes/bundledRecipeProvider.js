import { BUNDLED_RECIPE_LIMITS, RECIPE_LIMITS } from '../../config/recipes.js';
import { bundledCulinaryIngredients, bundledRecipeTemplates } from '../../data/bundledRecipes.js';
import { ingredientNutritionCatalog } from '../../data/ingredientNutrition.js';
import { deriveDietaryTags, satisfiesDietaryPreference } from '../../utils/recipeDietary.js';
import { canConvertRecipeUnits } from '../../utils/recipeUnits.js';
import { findBundledIngredient } from '../nutrition/bundledNutritionProvider.js';
import { providerRecipeBatchSchema } from '../../validators/recipeRecommendationValidators.js';

const nutritionById = new Map(
  ingredientNutritionCatalog.map((ingredient) => [ingredient.id, ingredient]),
);

function titleCase(value) {
  return value.replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase('en-US'));
}

function resolveInputIngredients(ingredients) {
  const seenIds = new Set();

  return ingredients.flatMap((input) => {
    const nutritionIngredient = findBundledIngredient(input.name);
    const culinaryIngredient = nutritionIngredient
      ? bundledCulinaryIngredients[nutritionIngredient.id]
      : null;
    if (!nutritionIngredient || !culinaryIngredient || seenIds.has(nutritionIngredient.id)) {
      return [];
    }

    seenIds.add(nutritionIngredient.id);
    return [{ input, nutritionIngredient, culinaryIngredient }];
  });
}

function groupsOverlap(ingredientGroups, acceptedGroups) {
  return ingredientGroups.some((group) => acceptedGroups.includes(group));
}

function portionForInput(resolvedInput) {
  const { input, culinaryIngredient, nutritionIngredient } = resolvedInput;
  if (input.quantity === undefined) return culinaryIngredient.portion;

  const unit = input.unit || culinaryIngredient.portion.unit;
  const conversionIsSupported =
    canConvertRecipeUnits(unit, nutritionIngredient.reference.unit) ||
    Number.isFinite(nutritionIngredient.conversions[unit]);
  if (!conversionIsSupported) return culinaryIngredient.portion;

  const maximum = BUNDLED_RECIPE_LIMITS.portionCaps[unit];
  return {
    quantity: maximum ? Math.min(input.quantity, maximum) : culinaryIngredient.portion.quantity,
    unit,
  };
}

function inputRecipeIngredient(resolvedInput) {
  const portion = portionForInput(resolvedInput);
  return {
    id: resolvedInput.nutritionIngredient.id,
    wasSupplied: true,
    ingredient: {
      name: resolvedInput.input.name,
      quantity: portion.quantity,
      unit: portion.unit,
      optional: false,
    },
  };
}

function bundledRecipeIngredient(id, overrides = {}) {
  const nutritionIngredient = nutritionById.get(id);
  if (!nutritionIngredient) {
    throw new TypeError(`Bundled recipe references unknown ingredient: ${id}.`);
  }
  const portion = bundledCulinaryIngredients[id]?.portion || nutritionIngredient.defaultMeasure;

  return {
    id,
    wasSupplied: false,
    ingredient: {
      name: nutritionIngredient.name,
      quantity: overrides.quantity ?? portion.quantity,
      unit: overrides.unit ?? portion.unit,
      optional: overrides.optional ?? false,
    },
  };
}

function selectSlotIngredients(slot, resolvedInputs, usedIds) {
  const selections = resolvedInputs
    .filter(
      ({ nutritionIngredient, culinaryIngredient }) =>
        !usedIds.has(nutritionIngredient.id) &&
        groupsOverlap(culinaryIngredient.groups, slot.groups),
    )
    .slice(0, slot.maximum)
    .map(inputRecipeIngredient);

  if (selections.length === 0) {
    selections.push(
      ...slot.fallbacks
        .filter((id) => !usedIds.has(id))
        .slice(0, slot.maximum)
        .map(bundledRecipeIngredient),
    );
  }

  selections.forEach(({ id }) => usedIds.add(id));
  return selections;
}

function templateHasInputMatch(template, resolvedInputs) {
  return resolvedInputs.some(({ culinaryIngredient }) =>
    groupsOverlap(culinaryIngredient.groups, template.eligibleGroups),
  );
}

function createCandidate(template, resolvedInputs) {
  const usedIds = new Set();
  const selected = template.slots.flatMap((slot) =>
    selectSlotIngredients(slot, resolvedInputs, usedIds),
  );
  const extras = template.extras
    .filter((extra) => !usedIds.has(extra.id))
    .map((extra) => {
      usedIds.add(extra.id);
      return bundledRecipeIngredient(extra.id, extra);
    });
  const combined = [...selected, ...extras];
  const primary = combined.find((entry) => entry.wasSupplied);
  if (!primary) return null;

  const ingredients = combined.map((entry) => entry.ingredient);
  return {
    title: `${titleCase(primary.ingredient.name)} ${template.titleSuffix}`,
    summary: template.summary,
    servings: template.servings,
    prepMinutes: template.prepMinutes,
    cookMinutes: template.cookMinutes,
    difficulty: template.difficulty,
    mealTypes: [...template.mealTypes],
    dietaryTags: deriveDietaryTags(ingredients),
    ingredients,
    steps: [...template.steps],
  };
}

function templateMeetsStaticFilters(template, request) {
  if (request.mealType !== 'any' && !template.mealTypes.includes(request.mealType)) return false;
  const totalMinutes = template.prepMinutes + template.cookMinutes;
  return !request.maxTotalTimeMinutes || totalMinutes <= request.maxTotalTimeMinutes;
}

export async function generateBundledRecipes(request) {
  if (request.signal?.aborted) throw request.signal.reason || new Error('Recipe request aborted.');

  const resolvedInputs = resolveInputIngredients(request.ingredients).filter(({ input }) =>
    satisfiesDietaryPreference([{ name: input.name }], request.dietaryPreference),
  );
  const recipes = [];

  for (const template of bundledRecipeTemplates) {
    if (recipes.length === RECIPE_LIMITS.recipesPerResponse.max) break;
    if (!templateHasInputMatch(template, resolvedInputs)) continue;
    if (!templateMeetsStaticFilters(template, request)) continue;

    const candidate = createCandidate(template, resolvedInputs);
    if (
      !candidate ||
      !satisfiesDietaryPreference(candidate.ingredients, request.dietaryPreference)
    ) {
      continue;
    }
    recipes.push(candidate);
  }

  return providerRecipeBatchSchema.parse({ recipes });
}

export const bundledRecipeProvider = Object.freeze({
  name: 'bundled',
  generateRecipes: generateBundledRecipes,
});
