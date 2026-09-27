import { Router } from 'express';

import {
  createFoodLog,
  deleteFoodLog,
  getDailySummary,
  getFoodLog,
  listFoodLogs,
  previewLoggedFoodNutrition,
  updateFoodLog,
} from '../controllers/foodLogController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest.js';
import {
  createFoodLogSchema,
  dailySummaryQuerySchema,
  foodLogIdParamsSchema,
  listFoodLogsQuerySchema,
  updateFoodLogSchema,
} from '../validators/foodLogValidators.js';
import { nutritionPreviewQuerySchema } from '../validators/foodCatalogValidators.js';

export function createFoodLogRouter({ authenticate = requireAuth } = {}) {
  const router = Router();
  router.use(authenticate);
  router.post('/', validateBody(createFoodLogSchema), asyncHandler(createFoodLog));
  router.get('/', validateQuery(listFoodLogsQuerySchema), asyncHandler(listFoodLogs));
  router.get('/summary', validateQuery(dailySummaryQuerySchema), asyncHandler(getDailySummary));
  router.get(
    '/:foodLogId/nutrition',
    validateParams(foodLogIdParamsSchema),
    validateQuery(nutritionPreviewQuerySchema),
    asyncHandler(previewLoggedFoodNutrition),
  );
  router.get('/:foodLogId', validateParams(foodLogIdParamsSchema), asyncHandler(getFoodLog));
  router.put(
    '/:foodLogId',
    validateParams(foodLogIdParamsSchema),
    validateBody(updateFoodLogSchema),
    asyncHandler(updateFoodLog),
  );
  router.patch(
    '/:foodLogId',
    validateParams(foodLogIdParamsSchema),
    validateBody(updateFoodLogSchema),
    asyncHandler(updateFoodLog),
  );
  router.delete('/:foodLogId', validateParams(foodLogIdParamsSchema), asyncHandler(deleteFoodLog));
  return router;
}

export const foodLogRouter = createFoodLogRouter();
