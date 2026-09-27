import {
  getSavedRecipe as getSavedRecipeService,
  listSavedRecipes as listSavedRecipesService,
  removeSavedRecipe as removeSavedRecipeService,
  saveRecipe as saveRecipeService,
} from '../services/savedRecipeService.js';
import { buildResponseMeta } from '../utils/apiResponse.js';

export function createSaveRecipeController({ save = saveRecipeService } = {}) {
  return async function saveRecipe(request, response) {
    const savedRecipe = await save({
      authenticatedUserId: request.auth.userId,
      input: request.validatedBody,
    });
    response.status(201).json({ data: { savedRecipe }, meta: buildResponseMeta(request) });
  };
}

export function createListSavedRecipesController({ list = listSavedRecipesService } = {}) {
  return async function listSavedRecipes(request, response) {
    const result = await list({
      authenticatedUserId: request.auth.userId,
      ...request.validatedQuery,
    });
    response.status(200).json({
      data: { savedRecipes: result.savedRecipes },
      meta: buildResponseMeta(request, { pagination: result.pagination }),
    });
  };
}

export function createGetSavedRecipeController({ get = getSavedRecipeService } = {}) {
  return async function getSavedRecipe(request, response) {
    const savedRecipe = await get({
      authenticatedUserId: request.auth.userId,
      savedRecipeId: request.validatedParams.savedRecipeId,
    });
    response.status(200).json({ data: { savedRecipe }, meta: buildResponseMeta(request) });
  };
}

export function createRemoveSavedRecipeController({ remove = removeSavedRecipeService } = {}) {
  return async function removeSavedRecipe(request, response) {
    await remove({
      authenticatedUserId: request.auth.userId,
      savedRecipeId: request.validatedParams.savedRecipeId,
    });
    response.status(204).end();
  };
}
