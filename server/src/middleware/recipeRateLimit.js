import { rateLimit } from 'express-rate-limit';

import { RECIPE_RUNTIME } from '../config/recipes.js';
import { buildResponseMeta } from '../utils/apiResponse.js';

const defaultOptions = {
  windowMs: RECIPE_RUNTIME.rateLimitWindowMs,
  limit: RECIPE_RUNTIME.rateLimitMaximum,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => String(request.auth.userId),
  handler: (request, response) =>
    response.status(429).json({
      error: {
        code: 'RECOMMENDATION_RATE_LIMITED',
        message: 'Too many recipe requests. Please try again later.',
      },
      meta: buildResponseMeta(request),
    }),
};

export function createRecipeRateLimit(overrides = {}) {
  return rateLimit({ ...defaultOptions, ...overrides });
}

export const recipeRateLimit = createRecipeRateLimit();
