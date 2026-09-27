import {
  createManualFoodLog,
  deleteManualFoodLog,
  getManualFoodLog,
  getOwnedFoodLogNutritionPreview,
  listManualFoodLogs,
  updateManualFoodLog,
} from '../services/foodLogService.js';
import { getDailyNutritionSummary } from '../services/dailySummaryService.js';
import { buildResponseMeta } from '../utils/apiResponse.js';

export async function createFoodLog(request, response) {
  const foodLog = await createManualFoodLog({
    authenticatedUserId: request.auth.userId,
    input: request.validatedBody,
  });
  response.status(201).json({ data: { foodLog }, meta: buildResponseMeta(request) });
}

export async function listFoodLogs(request, response) {
  const result = await listManualFoodLogs({
    authenticatedUserId: request.auth.userId,
    ...request.validatedQuery,
  });
  response.status(200).json({
    data: { foodLogs: result.foodLogs },
    meta: buildResponseMeta(request, {
      pagination: result.pagination,
      filters: { date: request.validatedQuery.date || null },
    }),
  });
}

export async function getDailySummary(request, response) {
  const summary = await getDailyNutritionSummary({
    authenticatedUserId: request.auth.userId,
    date: request.validatedQuery.date,
  });
  response.status(200).json({ data: { summary }, meta: buildResponseMeta(request) });
}

export async function getFoodLog(request, response) {
  const foodLog = await getManualFoodLog({
    authenticatedUserId: request.auth.userId,
    foodLogId: request.validatedParams.foodLogId,
  });
  response.status(200).json({ data: { foodLog }, meta: buildResponseMeta(request) });
}

export async function previewLoggedFoodNutrition(request, response) {
  const preview = await getOwnedFoodLogNutritionPreview({
    authenticatedUserId: request.auth.userId,
    foodLogId: request.validatedParams.foodLogId,
    quantity: request.validatedQuery.quantity,
    unit: request.validatedQuery.unit,
  });
  response.status(200).json({ data: { preview }, meta: buildResponseMeta(request) });
}

export async function updateFoodLog(request, response) {
  const foodLog = await updateManualFoodLog({
    authenticatedUserId: request.auth.userId,
    foodLogId: request.validatedParams.foodLogId,
    input: request.validatedBody,
  });
  response.status(200).json({ data: { foodLog }, meta: buildResponseMeta(request) });
}

export async function deleteFoodLog(request, response) {
  await deleteManualFoodLog({
    authenticatedUserId: request.auth.userId,
    foodLogId: request.validatedParams.foodLogId,
  });
  response.status(204).end();
}
