import { z } from 'zod';

export const foodSearchQuerySchema = z
  .object({
    search: z.string().trim().max(80, 'Search cannot exceed 80 characters.').default(''),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  .strict();

export const foodIdParamsSchema = z
  .object({
    foodId: z
      .string()
      .trim()
      .min(1, 'Food ID is required.')
      .max(80, 'Food ID cannot exceed 80 characters.')
      .regex(/^(?:usda|off)-[a-z0-9]+$/, 'Food ID is invalid.'),
  })
  .strict();

export const nutritionPreviewQuerySchema = z
  .object({
    quantity: z.coerce.number().finite().positive('Quantity must be greater than 0.'),
    unit: z.enum(['grams', 'milliliters', 'piece', 'serving'], {
      error: 'Unit must be grams, milliliters, piece, or serving.',
    }),
  })
  .strict();

export const customNutritionSchema = z
  .object({
    calories: z.coerce.number().finite().min(0).max(100_000),
    protein: z.coerce.number().finite().min(0).max(10_000),
    carbohydrates: z.coerce.number().finite().min(0).max(10_000),
    fat: z.coerce.number().finite().min(0).max(10_000),
    fiber: z.coerce.number().finite().min(0).max(10_000),
  })
  .strict();

export const customFoodSchema = z
  .object({
    name: z.string().trim().min(1, 'Food name is required.').max(120),
    description: z.string().trim().max(200).optional(),
    nutrition: customNutritionSchema,
  })
  .strict();

export const customNutritionPreviewSchema = z
  .object({
    customFood: customFoodSchema,
    quantity: z.coerce.number().finite().positive().max(100_000),
    unit: z.enum(['grams', 'milliliters', 'piece', 'serving']),
  })
  .strict();
