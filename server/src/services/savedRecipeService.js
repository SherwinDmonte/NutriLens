import { createHash } from 'node:crypto';

import * as defaultRepository from '../repositories/savedRecipeRepository.js';
import { AppError } from '../utils/AppError.js';
import { normalizeRecipeImageDescriptor } from './recipeImageService.js';

function duplicateError() {
  return new AppError(409, 'RECIPE_ALREADY_SAVED', 'This recipe is already in your saved recipes.');
}

function notFoundError() {
  return new AppError(404, 'SAVED_RECIPE_NOT_FOUND', 'The requested saved recipe was not found.');
}

function toPlainObject(savedRecipe) {
  return typeof savedRecipe?.toObject === 'function' ? savedRecipe.toObject() : savedRecipe;
}

function normalizedFingerprintInput(recipe) {
  const ingredients = [
    ...recipe.ingredients.available.map((ingredient) => ({
      group: 'available',
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      optional: ingredient.optional,
    })),
    ...recipe.ingredients.additional.map((ingredient) => ({
      group: 'additional',
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      optional: ingredient.optional,
    })),
  ].sort((left, right) =>
    `${left.group}:${left.name}`.localeCompare(`${right.group}:${right.name}`, 'en-US'),
  );

  return {
    title: recipe.title.toLocaleLowerCase('en-US'),
    servings: recipe.servings,
    time: recipe.time,
    difficulty: recipe.difficulty,
    mealTypes: [...recipe.mealTypes].sort(),
    dietaryTags: [...recipe.dietaryTags].sort(),
    ingredients,
    steps: recipe.steps.map((step) => step.instruction),
  };
}

export function createRecipeFingerprint(recipe) {
  return createHash('sha256')
    .update(JSON.stringify(normalizedFingerprintInput(recipe)))
    .digest('hex');
}

export function serializeSavedRecipe(savedRecipe) {
  const plainSavedRecipe = toPlainObject(savedRecipe);
  const recipe = structuredClone(plainSavedRecipe.snapshot);
  recipe.image = normalizeRecipeImageDescriptor(recipe);
  return {
    id: plainSavedRecipe._id.toString(),
    fingerprint: plainSavedRecipe.fingerprint,
    recipe,
    provider: plainSavedRecipe.provider,
    createdAt: plainSavedRecipe.createdAt,
    updatedAt: plainSavedRecipe.updatedAt,
  };
}

export function buildSavedRecipeData({ authenticatedUserId, input }) {
  const snapshot = structuredClone(input.recipe);
  snapshot.image = normalizeRecipeImageDescriptor(snapshot);
  return {
    userId: authenticatedUserId,
    fingerprint: createRecipeFingerprint(snapshot),
    snapshot,
    provider: structuredClone(input.provider),
  };
}

export async function saveRecipe(
  { authenticatedUserId, input },
  { repository = defaultRepository } = {},
) {
  const data = buildSavedRecipeData({ authenticatedUserId, input });
  const existing = await repository.findOwnedSavedRecipeByFingerprint({
    userId: authenticatedUserId,
    fingerprint: data.fingerprint,
  });
  if (existing) throw duplicateError();

  try {
    return serializeSavedRecipe(await repository.createSavedRecipe(data));
  } catch (error) {
    if (error?.code === 11_000) throw duplicateError();
    throw error;
  }
}

export async function listSavedRecipes(
  { authenticatedUserId, page, limit },
  { repository = defaultRepository } = {},
) {
  const { savedRecipes, total } = await repository.listOwnedSavedRecipes({
    userId: authenticatedUserId,
    page,
    limit,
  });

  return {
    savedRecipes: savedRecipes.map(serializeSavedRecipe),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getSavedRecipe(
  { authenticatedUserId, savedRecipeId },
  { repository = defaultRepository } = {},
) {
  const savedRecipe = await repository.findOwnedSavedRecipe({
    userId: authenticatedUserId,
    savedRecipeId,
  });
  if (!savedRecipe) throw notFoundError();
  return serializeSavedRecipe(savedRecipe);
}

export async function removeSavedRecipe(
  { authenticatedUserId, savedRecipeId },
  { repository = defaultRepository } = {},
) {
  const deletedRecipe = await repository.deleteOwnedSavedRecipe({
    userId: authenticatedUserId,
    savedRecipeId,
  });
  if (!deletedRecipe) throw notFoundError();
}
