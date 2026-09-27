import {
  assertRecipeImageSignature,
  recipeImageStorageService,
} from '../services/recipeImageStorageService.js';
import { AppError } from '../utils/AppError.js';

export function createGetRecipeImageController({ storage = recipeImageStorageService } = {}) {
  if (!storage || typeof storage.read !== 'function') {
    throw new TypeError('Recipe image storage must provide read(signature).');
  }

  return async function getRecipeImage(request, response) {
    const signature = assertRecipeImageSignature(request.params.signature);
    const bytes = await storage.read(signature);
    if (!bytes) {
      throw new AppError(
        404,
        'RECIPE_IMAGE_NOT_FOUND',
        'The requested recipe image was not found.',
      );
    }

    response
      .status(200)
      .set({
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Type': 'image/jpeg',
        'Cross-Origin-Resource-Policy': 'same-site',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(bytes);
  };
}

export const getRecipeImage = createGetRecipeImageController();
