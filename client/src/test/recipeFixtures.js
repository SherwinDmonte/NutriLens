export const recipeFixture = {
  id: 'bundled-test-recipe',
  title: 'Chickpea Tomato Rice Bowl',
  summary: 'A practical plant-forward bowl using ingredients already available.',
  servings: 2,
  time: { prepMinutes: 10, cookMinutes: 25, totalMinutes: 35 },
  difficulty: 'easy',
  mealTypes: ['lunch', 'dinner'],
  dietaryTags: ['vegetarian', 'vegan'],
  image: {
    url: '/api/recipe-images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    alt: 'AI-generated serving of Chickpea Tomato Rice Bowl featuring chickpeas and tomato',
    kind: 'generated',
    provider: 'cloudflare',
    ingredientSignature: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
  ingredients: {
    available: [
      {
        name: 'chickpeas',
        quantity: 200,
        unit: 'grams',
        optional: false,
        matchedInputName: 'chickpeas',
      },
      {
        name: 'tomato',
        quantity: 2,
        unit: 'piece',
        optional: false,
        matchedInputName: 'tomato',
      },
    ],
    additional: [{ name: 'olive oil', quantity: 1, unit: 'tablespoon', optional: false }],
  },
  steps: [
    { number: 1, instruction: 'Prepare the chickpeas, tomato, and rice.' },
    { number: 2, instruction: 'Cook until the vegetables are tender and serve safely.' },
  ],
  nutritionPerServing: {
    calories: 412.3,
    protein: 18.42,
    carbohydrates: 58.1,
    fat: 11.26,
    fiber: 12.05,
    estimated: true,
    provider: 'bundled',
    coveragePercent: 100,
    unmatchedIngredients: [],
    confidence: { score: 97, level: 'high' },
    provenance: {
      dataset: 'nutrilens-bundled-ingredients',
      version: '2026.09.25',
      calculationMethod: 'reference-scaling',
    },
    assumptions: [
      {
        ingredient: 'tomato',
        code: 'ingredient_specific_conversion',
        message: 'Converted piece using the bundled tomato measure.',
      },
    ],
  },
  match: {
    score: 91,
    components: { ingredient: 90, goal: 92, diet: 100, calories: 100, time: 100 },
    reason: 'Uses most of your ingredients and fits the selected balanced goal.',
  },
  source: 'bundled',
};

export const recipeResponseDataFixture = {
  status: 'partial',
  recipes: [recipeFixture],
  provider: {
    requested: 'bundled',
    used: 'bundled',
    fallbackUsed: false,
    fallbackReason: null,
  },
};
