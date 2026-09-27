export const ingredientOnlyRequestFixture = Object.freeze({
  ingredients: Object.freeze([
    Object.freeze({ name: 'chickpeas', quantity: 200, unit: 'grams' }),
    Object.freeze({ name: 'tomato' }),
    Object.freeze({ name: 'onion', quantity: 1, unit: 'piece' }),
  ]),
});

export const vegetarianRequestFixture = Object.freeze({
  ...ingredientOnlyRequestFixture,
  dietaryPreference: 'vegetarian',
});

export const eggetarianRequestFixture = Object.freeze({
  ingredients: Object.freeze([
    Object.freeze({ name: 'egg', quantity: 2, unit: 'piece' }),
    Object.freeze({ name: 'spinach', quantity: 100, unit: 'grams' }),
  ]),
  dietaryPreference: 'eggetarian',
});

export const veganRequestFixture = Object.freeze({
  ...ingredientOnlyRequestFixture,
  dietaryPreference: 'vegan',
});

export const highProteinRequestFixture = Object.freeze({
  ingredients: Object.freeze([
    Object.freeze({ name: 'chicken breast', quantity: 250, unit: 'grams' }),
    Object.freeze({ name: 'brown rice', quantity: 1, unit: 'cup' }),
  ]),
  goal: 'high-protein',
});

export const calorieLimitedRequestFixture = Object.freeze({
  ...vegetarianRequestFixture,
  goal: 'lower-calorie',
  maxCaloriesPerServing: 500,
});

export const timeLimitedRequestFixture = Object.freeze({
  ...veganRequestFixture,
  mealType: 'dinner',
  maxTotalTimeMinutes: 30,
  resultCount: 3,
});

export const emptyIngredientRequestFixture = Object.freeze({ ingredients: Object.freeze([]) });

export const providerRecipeFixture = Object.freeze({
  title: 'Chickpea Tomato Rice Bowl',
  summary: 'A quick plant-forward bowl using the ingredients already available.',
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 25,
  difficulty: 'easy',
  mealTypes: Object.freeze(['lunch', 'dinner']),
  dietaryTags: Object.freeze(['vegetarian', 'vegan']),
  ingredients: Object.freeze([
    Object.freeze({
      name: 'chickpeas',
      quantity: 200,
      unit: 'grams',
      optional: false,
    }),
    Object.freeze({ name: 'tomato', quantity: 2, unit: 'piece', optional: false }),
    Object.freeze({ name: 'olive oil', quantity: 1, unit: 'tablespoon', optional: false }),
  ]),
  steps: Object.freeze([
    'Prepare the chickpeas, tomato, and rice.',
    'Cook the ingredients until the vegetables are tender.',
  ]),
});

export const enrichedRecipeFixture = Object.freeze({
  id: 'recipe-8f84f2c8',
  title: providerRecipeFixture.title,
  summary: providerRecipeFixture.summary,
  servings: providerRecipeFixture.servings,
  time: Object.freeze({ prepMinutes: 10, cookMinutes: 25, totalMinutes: 35 }),
  difficulty: providerRecipeFixture.difficulty,
  mealTypes: providerRecipeFixture.mealTypes,
  dietaryTags: providerRecipeFixture.dietaryTags,
  image: Object.freeze({
    url: null,
    alt: 'AI-generated serving of Chickpea Tomato Rice Bowl featuring chickpeas, tomato',
    kind: 'unavailable',
    ingredientSignature: '6512bf44ebe423930e4a75931eee997e3503382dd9746a37b74f441ab5fb5fab',
  }),
  ingredients: Object.freeze({
    available: Object.freeze([
      Object.freeze({
        name: 'chickpeas',
        quantity: 200,
        unit: 'grams',
        optional: false,
        matchedInputName: 'chickpeas',
      }),
      Object.freeze({
        name: 'tomato',
        quantity: 2,
        unit: 'piece',
        optional: false,
        matchedInputName: 'tomato',
      }),
    ]),
    additional: Object.freeze([
      Object.freeze({
        name: 'olive oil',
        quantity: 1,
        unit: 'tablespoon',
        optional: false,
      }),
    ]),
  }),
  steps: Object.freeze([
    Object.freeze({ number: 1, instruction: providerRecipeFixture.steps[0] }),
    Object.freeze({ number: 2, instruction: providerRecipeFixture.steps[1] }),
  ]),
  nutritionPerServing: Object.freeze({
    calories: 412.3,
    protein: 18.42,
    carbohydrates: 58.1,
    fat: 11.26,
    fiber: 12.05,
    estimated: true,
    provider: 'bundled',
    coveragePercent: 100,
    unmatchedIngredients: Object.freeze([]),
    confidence: Object.freeze({ score: 97, level: 'high' }),
    provenance: Object.freeze({
      dataset: 'nutrilens-bundled-ingredients',
      version: '2026.09.25',
      calculationMethod: 'reference-scaling',
    }),
    assumptions: Object.freeze([
      Object.freeze({
        ingredient: 'tomato',
        code: 'ingredient_specific_conversion',
        message: 'Converted piece using the bundled tomato measure.',
      }),
    ]),
  }),
  match: Object.freeze({
    score: 91,
    components: Object.freeze({
      ingredient: 90,
      goal: 92,
      diet: 100,
      calories: 100,
      time: 100,
    }),
    reason: 'Uses most of your ingredients and fits the selected high-protein goal.',
  }),
  source: 'gemini',
});

export const recommendationResponseFixture = Object.freeze({
  data: Object.freeze({
    status: 'partial',
    recipes: Object.freeze([enrichedRecipeFixture]),
    provider: Object.freeze({
      requested: 'gemini',
      used: 'gemini',
      fallbackUsed: false,
      fallbackReason: null,
    }),
  }),
  meta: Object.freeze({
    apiVersion: '1',
    contractVersion: '2',
    requestId: '52d4b493-ef43-4785-b85f-7898ff8e7ddc',
  }),
});
