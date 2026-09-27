import { MEAL_ORDER } from '../config/foodLogs.js';
import { FoodLog } from '../models/FoodLog.js';
import * as defaultRepository from '../repositories/foodLogRepository.js';
import { AppError } from '../utils/AppError.js';
import * as defaultCatalog from './foodCatalogService.js';

function notFoundError() {
  return new AppError(404, 'FOOD_LOG_NOT_FOUND', 'The requested food log was not found.');
}

function toPlainObject(foodLog) {
  return typeof foodLog?.toObject === 'function' ? foodLog.toObject() : foodLog;
}

function legacyCatalogFood(foodLog) {
  const label =
    foodLog.unit === 'piece' ? 'pieces' : foodLog.unit === 'serving' ? 'servings' : foodLog.unit;
  return {
    id: foodLog.foodCatalogId,
    name: foodLog.foodName,
    description: 'Saved nutrition snapshot',
    category: 'previously logged food',
    baseServing: { quantity: foodLog.quantity, unit: foodLog.unit },
    supportedUnits: [
      {
        unit: foodLog.unit,
        label,
        referenceQuantityPerUnit: 1,
        defaultQuantity: foodLog.quantity,
        step: ['grams', 'milliliters'].includes(foodLog.unit) ? 1 : 0.25,
        min: 0.01,
        max: 100_000,
      },
    ],
    nutrition: {
      calories: foodLog.calories,
      protein: foodLog.protein,
      carbohydrates: foodLog.carbohydrates,
      fat: foodLog.fat,
      fiber: foodLog.fiber,
    },
    missingNutrients: [],
    source: {
      provider: 'legacy',
      label: 'Saved nutrition snapshot',
      externalId: foodLog.foodCatalogId,
      dataType: 'historical food log',
      license: 'saved before provider migration',
    },
  };
}

function catalogFoodForStoredLog(foodLog, catalog = defaultCatalog) {
  return foodLog.catalogSnapshot
    ? catalog.catalogFoodFromSnapshot(foodLog.catalogSnapshot)
    : legacyCatalogFood(foodLog);
}

export function serializeFoodLog(foodLog) {
  const plainFoodLog = toPlainObject(foodLog);
  const catalogFood = catalogFoodForStoredLog(plainFoodLog);
  return {
    id: plainFoodLog._id.toString(),
    date: plainFoodLog.date,
    mealType: plainFoodLog.mealType,
    foodCatalogId: plainFoodLog.foodCatalogId,
    foodName: plainFoodLog.foodName,
    quantity: plainFoodLog.quantity,
    unit: plainFoodLog.unit,
    nutrition: defaultCatalog.roundNutritionForResponse({
      calories: plainFoodLog.calories,
      protein: plainFoodLog.protein,
      carbohydrates: plainFoodLog.carbohydrates,
      fat: plainFoodLog.fat,
      fiber: plainFoodLog.fiber,
    }),
    catalogFood: defaultCatalog.serializeCatalogFood(catalogFood),
    foodSource: { ...catalogFood.source },
    source: plainFoodLog.source,
    createdAt: plainFoodLog.createdAt,
    updatedAt: plainFoodLog.updatedAt,
  };
}

export async function buildManualFoodLogData(
  { authenticatedUserId, input, food },
  { catalog = defaultCatalog } = {},
) {
  const selectedFood =
    food ||
    (input.customFood
      ? catalog.createCustomCatalogFood({
          customFood: input.customFood,
          quantity: input.quantity,
          unit: input.unit,
        })
      : await catalog.getCatalogFoodInternal(input.foodId));
  const snapshot = catalog.calculateNutritionSnapshotFromFood({
    food: selectedFood,
    quantity: input.quantity,
    unit: input.unit,
  });

  return {
    userId: authenticatedUserId,
    date: input.date,
    mealType: input.mealType,
    mealOrder: MEAL_ORDER[input.mealType],
    foodCatalogId: snapshot.foodId,
    foodName: snapshot.foodName,
    quantity: snapshot.quantity,
    unit: snapshot.unit,
    ...snapshot.nutrition,
    catalogSnapshot: snapshot.catalogSnapshot,
    source: 'manual',
  };
}

export async function buildManualFoodLog({ authenticatedUserId, input }, options) {
  return new FoodLog(await buildManualFoodLogData({ authenticatedUserId, input }, options));
}

export async function createManualFoodLog(
  { authenticatedUserId, input },
  { repository = defaultRepository, catalog = defaultCatalog } = {},
) {
  const data = await buildManualFoodLogData({ authenticatedUserId, input }, { catalog });
  const foodLog = await repository.createFoodLog(data);
  return serializeFoodLog(foodLog);
}

export async function listManualFoodLogs(
  { authenticatedUserId, date, page, limit },
  { repository = defaultRepository } = {},
) {
  const { foodLogs, total } = await repository.listOwnedFoodLogs({
    userId: authenticatedUserId,
    date,
    page,
    limit,
  });

  return {
    foodLogs: foodLogs.map(serializeFoodLog),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getManualFoodLog(
  { authenticatedUserId, foodLogId },
  { repository = defaultRepository } = {},
) {
  const foodLog = await repository.findOwnedFoodLog({
    userId: authenticatedUserId,
    foodLogId,
  });
  if (!foodLog) throw notFoundError();
  return serializeFoodLog(foodLog);
}

export async function updateManualFoodLog(
  { authenticatedUserId, foodLogId, input },
  { repository = defaultRepository, catalog = defaultCatalog } = {},
) {
  const existingFoodLog = await repository.findOwnedFoodLog({
    userId: authenticatedUserId,
    foodLogId,
  });
  if (!existingFoodLog) throw notFoundError();

  const foodChanged = Boolean(
    input.customFood || (input.foodId && input.foodId !== existingFoodLog.foodCatalogId),
  );
  const storedFood = foodChanged ? null : catalogFoodForStoredLog(existingFoodLog, catalog);
  const data = await buildManualFoodLogData(
    {
      authenticatedUserId,
      food: storedFood,
      input: {
        date: input.date ?? existingFoodLog.date,
        mealType: input.mealType ?? existingFoodLog.mealType,
        foodId: input.foodId ?? existingFoodLog.foodCatalogId,
        customFood: input.customFood,
        quantity: input.quantity ?? existingFoodLog.quantity,
        unit: input.unit ?? existingFoodLog.unit,
      },
    },
    { catalog },
  );
  const mutableData = {
    date: data.date,
    mealType: data.mealType,
    mealOrder: data.mealOrder,
    foodCatalogId: data.foodCatalogId,
    foodName: data.foodName,
    quantity: data.quantity,
    unit: data.unit,
    calories: data.calories,
    protein: data.protein,
    carbohydrates: data.carbohydrates,
    fat: data.fat,
    fiber: data.fiber,
    catalogSnapshot: data.catalogSnapshot,
  };

  const updatedFoodLog = await repository.updateOwnedFoodLog({
    userId: authenticatedUserId,
    foodLogId,
    update: mutableData,
  });
  if (!updatedFoodLog) throw notFoundError();
  return serializeFoodLog(updatedFoodLog);
}

export async function getOwnedFoodLogNutritionPreview(
  { authenticatedUserId, foodLogId, quantity, unit },
  { repository = defaultRepository, catalog = defaultCatalog } = {},
) {
  const foodLog = await repository.findOwnedFoodLog({
    userId: authenticatedUserId,
    foodLogId,
  });
  if (!foodLog) throw notFoundError();
  return catalog.getNutritionPreviewFromFood({
    food: catalogFoodForStoredLog(foodLog, catalog),
    quantity,
    unit,
  });
}

export async function deleteManualFoodLog(
  { authenticatedUserId, foodLogId },
  { repository = defaultRepository } = {},
) {
  const deletedFoodLog = await repository.deleteOwnedFoodLog({
    userId: authenticatedUserId,
    foodLogId,
  });
  if (!deletedFoodLog) throw notFoundError();
}
