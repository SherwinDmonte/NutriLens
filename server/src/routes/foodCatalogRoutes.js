import { Router } from 'express';

import { createFoodCatalogController } from '../controllers/foodCatalogController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest.js';
import {
  customNutritionPreviewSchema,
  foodIdParamsSchema,
  foodSearchQuerySchema,
  nutritionPreviewQuerySchema,
} from '../validators/foodCatalogValidators.js';

export function createFoodCatalogRouter({ authenticate = requireAuth, service } = {}) {
  const router = Router();
  const { getFood, listFoods, previewCustomFoodNutrition, previewFoodNutrition } =
    createFoodCatalogController({ service });
  router.use(authenticate);
  router.get('/', validateQuery(foodSearchQuerySchema), asyncHandler(listFoods));
  router.post(
    '/custom/nutrition',
    validateBody(customNutritionPreviewSchema),
    previewCustomFoodNutrition,
  );
  router.get(
    '/:foodId/nutrition',
    validateParams(foodIdParamsSchema),
    validateQuery(nutritionPreviewQuerySchema),
    asyncHandler(previewFoodNutrition),
  );
  router.get('/:foodId', validateParams(foodIdParamsSchema), asyncHandler(getFood));
  return router;
}

export const foodCatalogRouter = createFoodCatalogRouter();
