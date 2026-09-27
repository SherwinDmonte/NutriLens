import { z } from 'zod';

import { API_VERSION } from '../config/api.js';
import {
  DIETARY_PREFERENCES,
  NUTRITION_ASSUMPTION_CODES,
  NUTRITION_CONFIDENCE_LEVELS,
  NUTRITION_PROVIDERS,
  PROVIDER_MEAL_TYPES,
  RECIPE_CONTRACT_VERSION,
  RECIPE_DIFFICULTIES,
  RECIPE_FALLBACK_REASONS,
  RECIPE_GOALS,
  RECIPE_IMAGE_PROVIDERS,
  RECIPE_LIMITS,
  RECIPE_MEAL_TYPES,
  RECIPE_PROVIDERS,
  RECIPE_UNITS,
} from '../config/recipes.js';
import { normalizeRecipeUnit } from '../utils/recipeUnits.js';

const unsafeTextPattern = /[<>]|\b(?:javascript|data):|on[a-z]+\s*=/iu;

function containsUnsafeControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint <= 8 ||
      codePoint === 11 ||
      codePoint === 12 ||
      (codePoint >= 14 && codePoint <= 31) ||
      codePoint === 127
    );
  });
}

function collapseWhitespace(value) {
  return value.trim().replace(/\s+/gu, ' ');
}

function safeTextSchema({ label, min, max }) {
  return z
    .string({ error: `${label} is required.` })
    .transform(collapseWhitespace)
    .pipe(
      z
        .string()
        .min(min, `${label} is required.`)
        .max(max, `${label} cannot exceed ${max} characters.`)
        .refine(
          (value) => !unsafeTextPattern.test(value) && !containsUnsafeControlCharacter(value),
          `${label} contains unsupported markup or control characters.`,
        ),
    );
}

const ingredientNameSchema = safeTextSchema({
  label: 'Ingredient name',
  ...RECIPE_LIMITS.ingredientNameLength,
}).transform((value) => value.toLocaleLowerCase('en-US'));

const ingredientQuantitySchema = z
  .number({ error: 'Ingredient quantity must be a number.' })
  .finite('Ingredient quantity must be finite.')
  .positive('Ingredient quantity must be greater than 0.')
  .max(
    RECIPE_LIMITS.ingredientQuantity.max,
    `Ingredient quantity cannot exceed ${RECIPE_LIMITS.ingredientQuantity.max}.`,
  );

const canonicalUnitSchema = z.preprocess(
  (value) => {
    const normalizedUnit = normalizeRecipeUnit(value);
    return normalizedUnit === null ? value : normalizedUnit;
  },
  z.enum(RECIPE_UNITS, { error: 'Ingredient unit is not supported.' }),
);

const optionalCanonicalUnitSchema = z.preprocess(
  (value) => {
    if (value === null) return value;
    const normalizedUnit = normalizeRecipeUnit(value);
    return normalizedUnit === null ? value : normalizedUnit;
  },
  z.enum(RECIPE_UNITS, { error: 'Ingredient unit is not supported.' }).optional(),
);

function ensureQuantityUnitRelationship(ingredient, context) {
  if (ingredient.unit !== undefined && ingredient.quantity === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['unit'],
      message: 'Ingredient unit requires a quantity.',
    });
  }
}

export const recipeIngredientInputSchema = z
  .object({
    name: ingredientNameSchema,
    quantity: ingredientQuantitySchema.optional(),
    unit: optionalCanonicalUnitSchema,
  })
  .strict()
  .superRefine(ensureQuantityUnitRelationship);

function validateDuplicateIngredients(ingredients, context) {
  const aggregateByName = new Map();

  ingredients.forEach((ingredient, index) => {
    const existing = aggregateByName.get(ingredient.name);
    if (!existing) {
      aggregateByName.set(ingredient.name, { ...ingredient });
      return;
    }

    if (ingredient.quantity === undefined) return;

    if (existing.quantity === undefined) {
      aggregateByName.set(ingredient.name, { ...ingredient });
      return;
    }

    const existingUnit = existing.unit || null;
    const currentUnit = ingredient.unit || null;
    if (existingUnit !== currentUnit) {
      context.addIssue({
        code: 'custom',
        path: [index, 'unit'],
        message: 'Duplicate ingredients with quantities must use the same unit.',
      });
      return;
    }

    const combinedQuantity = existing.quantity + ingredient.quantity;
    if (combinedQuantity > RECIPE_LIMITS.ingredientQuantity.max) {
      context.addIssue({
        code: 'custom',
        path: [index, 'quantity'],
        message: `Combined ingredient quantity cannot exceed ${RECIPE_LIMITS.ingredientQuantity.max}.`,
      });
      return;
    }

    existing.quantity = combinedQuantity;
  });
}

function deduplicateIngredients(ingredients) {
  const uniqueIngredients = new Map();

  for (const ingredient of ingredients) {
    const existing = uniqueIngredients.get(ingredient.name);
    if (!existing) {
      uniqueIngredients.set(ingredient.name, { ...ingredient });
      continue;
    }

    if (existing.quantity === undefined && ingredient.quantity !== undefined) {
      uniqueIngredients.set(ingredient.name, { ...ingredient });
      continue;
    }

    if (existing.quantity !== undefined && ingredient.quantity !== undefined) {
      existing.quantity += ingredient.quantity;
    }
  }

  return [...uniqueIngredients.values()];
}

const recipeIngredientListSchema = z
  .array(recipeIngredientInputSchema)
  .min(
    RECIPE_LIMITS.ingredientsPerRequest.min,
    'Add at least one ingredient before requesting recipes.',
  )
  .max(
    RECIPE_LIMITS.ingredientsPerRequest.max,
    `You can add up to ${RECIPE_LIMITS.ingredientsPerRequest.max} ingredients.`,
  )
  .superRefine(validateDuplicateIngredients)
  .transform(deduplicateIngredients);

export const recipeRecommendationRequestSchema = z
  .object({
    ingredients: recipeIngredientListSchema,
    dietaryPreference: z.enum(DIETARY_PREFERENCES).default('none'),
    goal: z.enum(RECIPE_GOALS).default('balanced'),
    mealType: z.enum(RECIPE_MEAL_TYPES).default('any'),
    maxCaloriesPerServing: z
      .number()
      .int()
      .min(RECIPE_LIMITS.maxCaloriesPerServing.min)
      .max(RECIPE_LIMITS.maxCaloriesPerServing.max)
      .optional(),
    maxTotalTimeMinutes: z
      .number()
      .int()
      .min(RECIPE_LIMITS.maxTotalTimeMinutes.min)
      .max(RECIPE_LIMITS.maxTotalTimeMinutes.max)
      .optional(),
    resultCount: z
      .number()
      .int()
      .min(RECIPE_LIMITS.recipesPerResponse.min)
      .max(RECIPE_LIMITS.recipesPerResponse.max)
      .default(RECIPE_LIMITS.recipesPerResponse.default),
  })
  .strict();

const titleSchema = safeTextSchema({ label: 'Recipe title', ...RECIPE_LIMITS.titleLength });
const summarySchema = safeTextSchema({ label: 'Recipe summary', ...RECIPE_LIMITS.summaryLength });
const stepInstructionSchema = safeTextSchema({
  label: 'Recipe step',
  ...RECIPE_LIMITS.stepLength,
});
const recommendationReasonSchema = safeTextSchema({
  label: 'Recommendation reason',
  ...RECIPE_LIMITS.reasonLength,
});

function uniqueArraySchema(itemSchema, maximum, label) {
  return z
    .array(itemSchema)
    .max(maximum)
    .superRefine((values, context) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: 'custom', message: `${label} must not contain duplicates.` });
      }
    });
}

const providerIngredientSchema = z
  .object({
    name: ingredientNameSchema,
    quantity: ingredientQuantitySchema.nullable(),
    unit: canonicalUnitSchema.nullable(),
    optional: z.boolean(),
  })
  .strict()
  .superRefine((ingredient, context) => {
    if (ingredient.unit !== null && ingredient.quantity === null) {
      context.addIssue({
        code: 'custom',
        path: ['unit'],
        message: 'Ingredient unit requires a quantity.',
      });
    }
  });

function validateUniqueIngredientNames(ingredients, context) {
  const names = new Set();
  ingredients.forEach((ingredient, index) => {
    if (names.has(ingredient.name)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'name'],
        message: 'Recipe ingredients must not contain duplicates.',
      });
    }
    names.add(ingredient.name);
  });
}

export const providerRecipeSchema = z
  .object({
    title: titleSchema,
    summary: summarySchema,
    servings: z.number().int().min(RECIPE_LIMITS.servings.min).max(RECIPE_LIMITS.servings.max),
    prepMinutes: z.number().int().min(0).max(RECIPE_LIMITS.minutes.max),
    cookMinutes: z.number().int().min(0).max(RECIPE_LIMITS.minutes.max),
    difficulty: z.enum(RECIPE_DIFFICULTIES),
    mealTypes: uniqueArraySchema(
      z.enum(PROVIDER_MEAL_TYPES),
      PROVIDER_MEAL_TYPES.length,
      'Meal types',
    ).min(1),
    dietaryTags: uniqueArraySchema(
      z.enum(DIETARY_PREFERENCES.filter((preference) => preference !== 'none')),
      DIETARY_PREFERENCES.length - 1,
      'Dietary tags',
    ),
    ingredients: z
      .array(providerIngredientSchema)
      .min(RECIPE_LIMITS.ingredientsPerRecipe.min)
      .max(RECIPE_LIMITS.ingredientsPerRecipe.max)
      .superRefine(validateUniqueIngredientNames),
    steps: z
      .array(stepInstructionSchema)
      .min(RECIPE_LIMITS.stepsPerRecipe.min)
      .max(RECIPE_LIMITS.stepsPerRecipe.max),
  })
  .strict();

function validateUniqueRecipes(recipes, context) {
  const ids = new Set();
  const titles = new Set();

  recipes.forEach((recipe, index) => {
    if (recipe.id !== undefined) {
      if (ids.has(recipe.id)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: 'Recipe IDs must be unique.',
        });
      }
      ids.add(recipe.id);
    }

    const normalizedTitle = recipe.title.toLocaleLowerCase('en-US');
    if (titles.has(normalizedTitle)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'title'],
        message: 'Recipe titles must be unique.',
      });
    }
    titles.add(normalizedTitle);
  });
}

export const providerRecipeBatchSchema = z
  .object({
    recipes: z
      .array(providerRecipeSchema)
      .max(RECIPE_LIMITS.recipesPerResponse.max)
      .superRefine(validateUniqueRecipes),
  })
  .strict();

const publicIngredientBaseShape = {
  name: ingredientNameSchema,
  quantity: ingredientQuantitySchema.nullable(),
  unit: canonicalUnitSchema.nullable(),
  optional: z.boolean(),
};

const availableRecipeIngredientSchema = z
  .object({
    ...publicIngredientBaseShape,
    matchedInputName: ingredientNameSchema,
  })
  .strict()
  .superRefine((ingredient, context) => {
    if (ingredient.unit !== null && ingredient.quantity === null) {
      context.addIssue({
        code: 'custom',
        path: ['unit'],
        message: 'Ingredient unit requires a quantity.',
      });
    }
  });

const additionalRecipeIngredientSchema = z
  .object(publicIngredientBaseShape)
  .strict()
  .superRefine((ingredient, context) => {
    if (ingredient.unit !== null && ingredient.quantity === null) {
      context.addIssue({
        code: 'custom',
        path: ['unit'],
        message: 'Ingredient unit requires a quantity.',
      });
    }
  });

const nonNegativeNutritionValueSchema = z.number().finite().nonnegative();
const scoreSchema = z.number().finite().min(0).max(100);
const nutritionAssumptionSchema = z
  .object({
    ingredient: ingredientNameSchema,
    code: z.enum(NUTRITION_ASSUMPTION_CODES),
    message: safeTextSchema({ label: 'Nutrition assumption', min: 1, max: 200 }),
  })
  .strict();

export const nutritionEstimateSchema = z
  .object({
    calories: nonNegativeNutritionValueSchema.max(5_000),
    protein: nonNegativeNutritionValueSchema.max(1_000),
    carbohydrates: nonNegativeNutritionValueSchema.max(1_000),
    fat: nonNegativeNutritionValueSchema.max(1_000),
    fiber: nonNegativeNutritionValueSchema.max(500),
    estimated: z.literal(true),
    provider: z.enum(NUTRITION_PROVIDERS),
    coveragePercent: scoreSchema,
    unmatchedIngredients: uniqueArraySchema(
      ingredientNameSchema,
      RECIPE_LIMITS.ingredientsPerRecipe.max,
      'Unmatched ingredients',
    ),
    confidence: z
      .object({
        score: scoreSchema,
        level: z.enum(NUTRITION_CONFIDENCE_LEVELS),
      })
      .strict(),
    provenance: z
      .object({
        dataset: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .regex(/^[a-z0-9-]+$/),
        version: z
          .string()
          .trim()
          .min(1)
          .max(32)
          .regex(/^[0-9.]+$/),
        calculationMethod: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .regex(/^[a-z0-9-]+$/),
      })
      .strict(),
    assumptions: z.array(nutritionAssumptionSchema).max(RECIPE_LIMITS.ingredientsPerRecipe.max * 2),
  })
  .strict();

const recipeTimeSchema = z
  .object({
    prepMinutes: z.number().int().min(0).max(RECIPE_LIMITS.minutes.max),
    cookMinutes: z.number().int().min(0).max(RECIPE_LIMITS.minutes.max),
    totalMinutes: z.number().int().min(0).max(RECIPE_LIMITS.minutes.max),
  })
  .strict()
  .superRefine((time, context) => {
    if (time.totalMinutes !== time.prepMinutes + time.cookMinutes) {
      context.addIssue({
        code: 'custom',
        path: ['totalMinutes'],
        message: 'Total time must equal preparation time plus cooking time.',
      });
    }
  });

const recipeMatchSchema = z
  .object({
    score: scoreSchema,
    components: z
      .object({
        ingredient: scoreSchema,
        goal: scoreSchema,
        diet: scoreSchema,
        calories: scoreSchema,
        time: scoreSchema,
      })
      .strict(),
    reason: recommendationReasonSchema,
  })
  .strict();

const recipeImageSignatureSchema = z
  .string()
  .regex(/^[a-f\d]{64}$/u, 'Recipe image signature is invalid.');

const generatedRecipeImageSchema = z
  .object({
    url: z
      .string()
      .regex(
        /^\/api\/recipe-images\/[a-f\d]{64}\.jpg$/u,
        'Recipe image must use an approved generated-image path.',
      ),
    alt: safeTextSchema({ label: 'Recipe image alternative text', min: 1, max: 160 }),
    kind: z.literal('generated'),
    provider: z.enum(RECIPE_IMAGE_PROVIDERS),
    ingredientSignature: recipeImageSignatureSchema,
  })
  .strict()
  .superRefine((image, context) => {
    if (image.url !== `/api/recipe-images/${image.ingredientSignature}.jpg`) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'Recipe image URL must match its ingredient signature.',
      });
    }
  });

const unavailableRecipeImageSchema = z
  .object({
    url: z.null(),
    alt: safeTextSchema({ label: 'Recipe image alternative text', min: 1, max: 160 }),
    kind: z.literal('unavailable'),
    ingredientSignature: recipeImageSignatureSchema,
  })
  .strict();

export const recipeImageSchema = z.union([
  generatedRecipeImageSchema,
  unavailableRecipeImageSchema,
]);

export const enrichedRecipeSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'Recipe ID is invalid.'),
    title: titleSchema,
    summary: summarySchema,
    servings: z.number().int().min(RECIPE_LIMITS.servings.min).max(RECIPE_LIMITS.servings.max),
    time: recipeTimeSchema,
    difficulty: z.enum(RECIPE_DIFFICULTIES),
    mealTypes: uniqueArraySchema(
      z.enum(PROVIDER_MEAL_TYPES),
      PROVIDER_MEAL_TYPES.length,
      'Meal types',
    ).min(1),
    dietaryTags: uniqueArraySchema(
      z.enum(DIETARY_PREFERENCES.filter((preference) => preference !== 'none')),
      DIETARY_PREFERENCES.length - 1,
      'Dietary tags',
    ),
    image: recipeImageSchema,
    ingredients: z
      .object({
        available: z
          .array(availableRecipeIngredientSchema)
          .max(RECIPE_LIMITS.ingredientsPerRecipe.max),
        additional: z
          .array(additionalRecipeIngredientSchema)
          .max(RECIPE_LIMITS.ingredientsPerRecipe.max),
      })
      .strict()
      .superRefine((ingredients, context) => {
        const combinedIngredients = [...ingredients.available, ...ingredients.additional];
        if (combinedIngredients.length === 0) {
          context.addIssue({
            code: 'custom',
            message: 'Recipe must contain at least one ingredient.',
          });
        }
        if (combinedIngredients.length > RECIPE_LIMITS.ingredientsPerRecipe.max) {
          context.addIssue({
            code: 'custom',
            message: `Recipe cannot contain more than ${RECIPE_LIMITS.ingredientsPerRecipe.max} ingredients.`,
          });
        }
        validateUniqueIngredientNames(combinedIngredients, context);
      }),
    steps: z
      .array(
        z
          .object({
            number: z.number().int().positive(),
            instruction: stepInstructionSchema,
          })
          .strict(),
      )
      .min(RECIPE_LIMITS.stepsPerRecipe.min)
      .max(RECIPE_LIMITS.stepsPerRecipe.max)
      .superRefine((steps, context) => {
        steps.forEach((step, index) => {
          if (step.number !== index + 1) {
            context.addIssue({
              code: 'custom',
              path: [index, 'number'],
              message: 'Recipe steps must use consecutive numbering starting at 1.',
            });
          }
        });
      }),
    nutritionPerServing: nutritionEstimateSchema,
    match: recipeMatchSchema,
    source: z.enum(RECIPE_PROVIDERS),
  })
  .strict();

export const providerMetadataSchema = z
  .object({
    requested: z.enum(RECIPE_PROVIDERS),
    used: z.enum(RECIPE_PROVIDERS),
    fallbackUsed: z.boolean(),
    fallbackReason: z.enum(RECIPE_FALLBACK_REASONS).nullable(),
  })
  .strict()
  .superRefine((provider, context) => {
    if (!provider.fallbackUsed && provider.fallbackReason !== null) {
      context.addIssue({
        code: 'custom',
        path: ['fallbackReason'],
        message: 'Fallback reason must be null when fallback was not used.',
      });
    }
    if (!provider.fallbackUsed && provider.requested !== provider.used) {
      context.addIssue({
        code: 'custom',
        path: ['used'],
        message: 'Requested and used providers must match when fallback was not used.',
      });
    }
    if (provider.fallbackUsed && provider.used !== 'bundled') {
      context.addIssue({
        code: 'custom',
        path: ['used'],
        message: 'Fallback responses must use the bundled provider.',
      });
    }
    if (provider.fallbackUsed && provider.fallbackReason === null) {
      context.addIssue({
        code: 'custom',
        path: ['fallbackReason'],
        message: 'Fallback responses must include a public fallback reason.',
      });
    }
    if (provider.fallbackUsed && provider.requested !== 'gemini') {
      context.addIssue({
        code: 'custom',
        path: ['requested'],
        message: 'Only Gemini requests can use the bundled fallback provider.',
      });
    }
  });

const recommendationDataSchema = z
  .object({
    status: z.enum(['ok', 'partial', 'no_match']),
    recipes: z
      .array(enrichedRecipeSchema)
      .max(RECIPE_LIMITS.recipesPerResponse.max)
      .superRefine(validateUniqueRecipes),
    provider: providerMetadataSchema,
  })
  .strict()
  .superRefine((data, context) => {
    if (data.status === 'no_match' && data.recipes.length !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['recipes'],
        message: 'No-match responses cannot contain recipes.',
      });
    }
    if (data.status !== 'no_match' && data.recipes.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['recipes'],
        message: 'Successful recommendation responses must contain at least one recipe.',
      });
    }
    if (data.status === 'ok' && data.recipes.length < RECIPE_LIMITS.recipesPerResponse.min) {
      context.addIssue({
        code: 'custom',
        path: ['recipes'],
        message: `Complete recommendation responses must contain at least ${RECIPE_LIMITS.recipesPerResponse.min} recipes.`,
      });
    }
    if (data.status === 'partial' && data.recipes.length >= RECIPE_LIMITS.recipesPerResponse.max) {
      context.addIssue({
        code: 'custom',
        path: ['recipes'],
        message: 'A five-recipe response must use the complete status.',
      });
    }
    data.recipes.forEach((recipe, index) => {
      if (recipe.source !== data.provider.used) {
        context.addIssue({
          code: 'custom',
          path: ['recipes', index, 'source'],
          message: 'Recipe source must match the provider used for the response.',
        });
      }
    });
  });

export const recipeRecommendationResponseSchema = z
  .object({
    data: recommendationDataSchema,
    meta: z
      .object({
        apiVersion: z.literal(API_VERSION),
        contractVersion: z.literal(RECIPE_CONTRACT_VERSION),
        requestId: z.string().uuid(),
      })
      .strict(),
  })
  .strict();
