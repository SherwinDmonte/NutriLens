import { RECIPE_CONTRACT_VERSION } from '../config/recipes.js';
import { getRecipeRecommendations } from '../services/recipeRecommendationService.js';
import { buildResponseMeta } from '../utils/apiResponse.js';
import { recipeRecommendationResponseSchema } from '../validators/recipeRecommendationValidators.js';

export function createRecommendRecipesController({ recommend = getRecipeRecommendations } = {}) {
  return async function recommendRecipes(request, response) {
    const disconnectController = new AbortController();
    const abortOnDisconnect = () => disconnectController.abort(new Error('Client disconnected.'));
    const abortOnClose = () => {
      if (!response.writableEnded) abortOnDisconnect();
    };

    request.once('aborted', abortOnDisconnect);
    response.once('close', abortOnClose);

    try {
      const data = await recommend({
        authenticatedUserId: request.auth.userId,
        input: request.validatedBody,
        requestId: request.requestId,
        signal: disconnectController.signal,
      });
      const payload = recipeRecommendationResponseSchema.parse({
        data,
        meta: buildResponseMeta(request, { contractVersion: RECIPE_CONTRACT_VERSION }),
      });
      return response.status(200).json(payload);
    } finally {
      request.removeListener('aborted', abortOnDisconnect);
      response.removeListener('close', abortOnClose);
    }
  };
}

export const recommendRecipes = createRecommendRecipesController();
