import * as defaultService from '../services/foodCatalogService.js';

export function createFoodCatalogController({ service = defaultService } = {}) {
  return {
    async listFoods(request, response) {
      const { search, limit } = request.validatedQuery;
      const result = await service.searchCatalogFoods({
        search,
        limit,
        signal: request.signal,
      });

      response.status(200).json({
        data: {
          foods: result.foods,
          search,
          count: result.foods.length,
          limit,
          providers: result.providers,
          unavailableProviders: result.unavailableProviders,
        },
      });
    },

    async getFood(request, response) {
      const food = await service.getCatalogFood(request.validatedParams.foodId, {
        signal: request.signal,
      });
      response.status(200).json({ data: { food } });
    },

    async previewFoodNutrition(request, response) {
      const preview = await service.getNutritionPreview({
        foodId: request.validatedParams.foodId,
        quantity: request.validatedQuery.quantity,
        unit: request.validatedQuery.unit,
        signal: request.signal,
      });

      response.status(200).json({ data: { preview } });
    },

    previewCustomFoodNutrition(request, response) {
      const preview = service.getCustomNutritionPreview(request.validatedBody);
      response.status(200).json({ data: { preview } });
    },
  };
}

const defaultController = createFoodCatalogController();

export const listFoods = defaultController.listFoods;
export const getFood = defaultController.getFood;
export const previewFoodNutrition = defaultController.previewFoodNutrition;
export const previewCustomFoodNutrition = defaultController.previewCustomFoodNutrition;
