import { z } from 'zod';

import { enrichedRecipeSchema, providerMetadataSchema } from './recipeRecommendationValidators.js';

export const saveRecipeSchema = z
  .object({
    recipe: enrichedRecipeSchema,
    provider: providerMetadataSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.recipe.source !== input.provider.used) {
      context.addIssue({
        code: 'custom',
        path: ['recipe', 'source'],
        message: 'Recipe source must match the provider used for the recommendation.',
      });
    }
  });

export const savedRecipeIdParamsSchema = z
  .object({
    savedRecipeId: z.string().regex(/^[a-f\d]{24}$/i, 'Saved recipe ID is invalid.'),
  })
  .strict();

export const listSavedRecipesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict();
