import { z } from 'zod';

import { FOOD_LOG_UNITS, MEAL_TYPES } from '../config/foodLogs.js';
import { isCanonicalCalendarDate } from '../utils/calendarDate.js';
import { customFoodSchema } from './foodCatalogValidators.js';

export const calendarDateSchema = z
  .string({ error: 'Date is required.' })
  .refine(isCanonicalCalendarDate, 'Date must be a real calendar date in YYYY-MM-DD format.');

const foodSelectionShape = {
  date: calendarDateSchema,
  mealType: z.enum(MEAL_TYPES, {
    error: 'Meal type must be breakfast, lunch, dinner, or snack.',
  }),
  foodId: z
    .string({ error: 'Food is required.' })
    .trim()
    .min(1, 'Food is required.')
    .max(80, 'Food ID cannot exceed 80 characters.')
    .regex(/^[a-z0-9-]+$/, 'Food ID is invalid.')
    .optional(),
  customFood: customFoodSchema.optional(),
  quantity: z.coerce.number().finite().positive('Quantity must be greater than 0.'),
  unit: z.enum(FOOD_LOG_UNITS, {
    error: 'Unit must be grams, milliliters, piece, or serving.',
  }),
};

function validateFoodAuthority(input, context, { requireSelection }) {
  if (input.foodId && input.customFood) {
    context.addIssue({
      code: 'custom',
      path: ['foodId'],
      message: 'Choose a catalog food or provide a custom food, not both.',
    });
  }
  if (requireSelection && !input.foodId && !input.customFood) {
    context.addIssue({ code: 'custom', path: ['foodId'], message: 'Food is required.' });
  }
}

export const createFoodLogSchema = z
  .object(foodSelectionShape)
  .superRefine((input, context) =>
    validateFoodAuthority(input, context, { requireSelection: true }),
  );

export const updateFoodLogSchema = z
  .object(foodSelectionShape)
  .partial()
  .superRefine((input, context) =>
    validateFoodAuthority(input, context, { requireSelection: false }),
  )
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Provide at least one supported field to update.',
  });

export const foodLogIdParamsSchema = z
  .object({
    foodLogId: z.string().regex(/^[a-f\d]{24}$/i, 'Food log ID is invalid.'),
  })
  .strict();

export const listFoodLogsQuerySchema = z
  .object({
    date: calendarDateSchema.optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const dailySummaryQuerySchema = z
  .object({
    date: calendarDateSchema,
  })
  .strict();
