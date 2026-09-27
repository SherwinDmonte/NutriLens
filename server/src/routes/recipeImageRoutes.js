import { Router } from 'express';

import { createGetRecipeImageController } from '../controllers/recipeImageController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { recipeImageStorageService } from '../services/recipeImageStorageService.js';

export function createRecipeImageRouter({
  authenticate = requireAuth,
  storage = recipeImageStorageService,
} = {}) {
  const router = Router();
  router.use(authenticate);
  router.get('/:signature.jpg', asyncHandler(createGetRecipeImageController({ storage })));
  return router;
}

export const recipeImageRouter = createRecipeImageRouter();
