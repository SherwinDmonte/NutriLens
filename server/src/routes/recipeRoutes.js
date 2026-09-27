import { Router } from 'express';

import { createRecommendRecipesController } from '../controllers/recipeController.js';
import {
  createGetSavedRecipeController,
  createListSavedRecipesController,
  createRemoveSavedRecipeController,
  createSaveRecipeController,
} from '../controllers/savedRecipeController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { recipeRateLimit } from '../middleware/recipeRateLimit.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest.js';
import { getRecipeRecommendations } from '../services/recipeRecommendationService.js';
import {
  getSavedRecipe,
  listSavedRecipes,
  removeSavedRecipe,
  saveRecipe,
} from '../services/savedRecipeService.js';
import { recipeRecommendationRequestSchema } from '../validators/recipeRecommendationValidators.js';
import {
  listSavedRecipesQuerySchema,
  savedRecipeIdParamsSchema,
  saveRecipeSchema,
} from '../validators/savedRecipeValidators.js';

export function createRecipeRouter({
  authenticate = requireAuth,
  rateLimiter = recipeRateLimit,
  recommend = getRecipeRecommendations,
  save = saveRecipe,
  listSaved = listSavedRecipes,
  getSaved = getSavedRecipe,
  removeSaved = removeSavedRecipe,
} = {}) {
  const router = Router();
  router.use(authenticate);
  router.post(
    '/saved',
    validateBody(saveRecipeSchema),
    asyncHandler(createSaveRecipeController({ save })),
  );
  router.get(
    '/saved',
    validateQuery(listSavedRecipesQuerySchema),
    asyncHandler(createListSavedRecipesController({ list: listSaved })),
  );
  router.get(
    '/saved/:savedRecipeId',
    validateParams(savedRecipeIdParamsSchema),
    asyncHandler(createGetSavedRecipeController({ get: getSaved })),
  );
  router.delete(
    '/saved/:savedRecipeId',
    validateParams(savedRecipeIdParamsSchema),
    asyncHandler(createRemoveSavedRecipeController({ remove: removeSaved })),
  );
  router.post(
    '/recommend',
    rateLimiter,
    validateBody(recipeRecommendationRequestSchema),
    asyncHandler(createRecommendRecipesController({ recommend })),
  );
  return router;
}

export const recipeRouter = createRecipeRouter();
