function freezeIngredient(entry) {
  return Object.freeze({
    ...entry,
    groups: Object.freeze(entry.groups),
    portion: Object.freeze(entry.portion),
  });
}

const rawCulinaryIngredients = [
  {
    id: 'white-rice-cooked',
    groups: ['grain'],
    dietClass: 'plant',
    portion: { quantity: 150, unit: 'grams' },
  },
  {
    id: 'brown-rice-cooked',
    groups: ['grain'],
    dietClass: 'plant',
    portion: { quantity: 150, unit: 'grams' },
  },
  {
    id: 'rolled-oats-dry',
    groups: ['grain', 'breakfast-base'],
    dietClass: 'plant',
    portion: { quantity: 50, unit: 'grams' },
  },
  {
    id: 'quinoa-cooked',
    groups: ['grain'],
    dietClass: 'plant',
    portion: { quantity: 150, unit: 'grams' },
  },
  {
    id: 'chickpeas-cooked',
    groups: ['protein', 'legume', 'spreadable-protein'],
    dietClass: 'plant',
    portion: { quantity: 130, unit: 'grams' },
  },
  {
    id: 'lentils-cooked',
    groups: ['protein', 'legume'],
    dietClass: 'plant',
    portion: { quantity: 150, unit: 'grams' },
  },
  {
    id: 'kidney-beans-cooked',
    groups: ['protein', 'legume', 'spreadable-protein'],
    dietClass: 'plant',
    portion: { quantity: 130, unit: 'grams' },
  },
  {
    id: 'black-beans-cooked',
    groups: ['protein', 'legume', 'spreadable-protein'],
    dietClass: 'plant',
    portion: { quantity: 130, unit: 'grams' },
  },
  {
    id: 'tofu-firm',
    groups: ['protein', 'scramble-protein', 'spreadable-protein'],
    dietClass: 'plant',
    portion: { quantity: 120, unit: 'grams' },
  },
  {
    id: 'paneer',
    groups: ['protein', 'scramble-protein'],
    dietClass: 'dairy',
    portion: { quantity: 100, unit: 'grams' },
  },
  {
    id: 'chicken-breast-cooked',
    groups: ['protein', 'spreadable-protein'],
    dietClass: 'meat',
    portion: { quantity: 120, unit: 'grams' },
  },
  {
    id: 'egg-whole',
    groups: ['protein', 'scramble-protein', 'spreadable-protein'],
    dietClass: 'egg',
    portion: { quantity: 2, unit: 'piece' },
  },
  {
    id: 'greek-yogurt-plain',
    groups: ['dairy', 'breakfast-topping'],
    dietClass: 'dairy',
    portion: { quantity: 170, unit: 'grams' },
  },
  {
    id: 'milk-whole',
    groups: ['dairy', 'breakfast-liquid', 'breakfast-topping'],
    dietClass: 'dairy',
    portion: { quantity: 1, unit: 'cup' },
  },
  {
    id: 'tomato-raw',
    groups: ['vegetable', 'fresh-vegetable'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'piece' },
  },
  {
    id: 'onion-raw',
    groups: ['vegetable'],
    dietClass: 'plant',
    portion: { quantity: 0.5, unit: 'piece' },
  },
  {
    id: 'spinach-raw',
    groups: ['vegetable', 'fresh-vegetable'],
    dietClass: 'plant',
    portion: { quantity: 2, unit: 'cup' },
  },
  {
    id: 'bell-pepper-raw',
    groups: ['vegetable', 'fresh-vegetable'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'piece' },
  },
  {
    id: 'broccoli-raw',
    groups: ['vegetable'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'cup' },
  },
  {
    id: 'carrot-raw',
    groups: ['vegetable', 'fresh-vegetable'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'piece' },
  },
  {
    id: 'cucumber-raw',
    groups: ['vegetable', 'fresh-vegetable'],
    dietClass: 'plant',
    portion: { quantity: 0.5, unit: 'piece' },
  },
  {
    id: 'potato-raw',
    groups: ['vegetable', 'starchy-vegetable'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'piece' },
  },
  {
    id: 'sweet-potato-raw',
    groups: ['vegetable', 'starchy-vegetable'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'piece' },
  },
  {
    id: 'avocado-raw',
    groups: ['fruit', 'fresh-vegetable', 'spreadable-protein'],
    dietClass: 'plant',
    portion: { quantity: 0.5, unit: 'piece' },
  },
  {
    id: 'banana-raw',
    groups: ['fruit'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'piece' },
  },
  {
    id: 'apple-raw',
    groups: ['fruit'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'piece' },
  },
  {
    id: 'mushroom-raw',
    groups: ['vegetable'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'cup' },
  },
  {
    id: 'whole-wheat-bread',
    groups: ['bread'],
    dietClass: 'plant',
    portion: { quantity: 2, unit: 'piece' },
  },
  {
    id: 'whole-wheat-tortilla',
    groups: ['wrap'],
    dietClass: 'plant',
    portion: { quantity: 2, unit: 'piece' },
  },
  {
    id: 'peanut-butter',
    groups: ['breakfast-topping'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'tablespoon' },
  },
  {
    id: 'almonds',
    groups: ['breakfast-topping'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'serving' },
  },
  {
    id: 'chia-seeds',
    groups: ['breakfast-topping'],
    dietClass: 'plant',
    portion: { quantity: 1, unit: 'tablespoon' },
  },
  {
    id: 'cheddar-cheese',
    groups: ['dairy', 'breakfast-topping'],
    dietClass: 'dairy',
    portion: { quantity: 1, unit: 'serving' },
  },
];

export const bundledCulinaryIngredients = Object.freeze(
  Object.fromEntries(rawCulinaryIngredients.map((entry) => [entry.id, freezeIngredient(entry)])),
);

function freezeSlot(slot) {
  return Object.freeze({
    ...slot,
    groups: Object.freeze(slot.groups),
    fallbacks: Object.freeze(slot.fallbacks),
  });
}

function freezeExtra(extra) {
  return Object.freeze({ ...extra });
}

function freezeTemplate(template) {
  return Object.freeze({
    ...template,
    mealTypes: Object.freeze(template.mealTypes),
    eligibleGroups: Object.freeze(template.eligibleGroups),
    slots: Object.freeze(template.slots.map(freezeSlot)),
    extras: Object.freeze(template.extras.map(freezeExtra)),
    steps: Object.freeze(template.steps),
  });
}

const rawTemplates = [
  {
    id: 'grain-bowl',
    titleSuffix: 'Grain Bowl',
    summary: 'A satisfying grain bowl with a protein, vegetables, and a bright lemon dressing.',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 20,
    difficulty: 'easy',
    mealTypes: ['lunch', 'dinner'],
    eligibleGroups: ['grain', 'protein', 'vegetable'],
    slots: [
      { groups: ['grain'], fallbacks: ['brown-rice-cooked'], maximum: 1 },
      { groups: ['protein'], fallbacks: ['chickpeas-cooked'], maximum: 1 },
      { groups: ['vegetable'], fallbacks: ['spinach-raw'], maximum: 2 },
    ],
    extras: [
      { id: 'olive-oil', quantity: 1, unit: 'tablespoon' },
      { id: 'lemon-juice', quantity: 1, unit: 'tablespoon' },
      { id: 'black-pepper', quantity: 0.25, unit: 'teaspoon', optional: true },
    ],
    steps: [
      'Prepare the grain, protein, and vegetables.',
      'Cook any ingredients that are not ready to eat until safely done and tender.',
      'Divide between bowls and finish with lemon juice and olive oil.',
    ],
  },
  {
    id: 'fresh-salad',
    titleSuffix: 'Fresh Salad',
    summary: 'A crisp protein-forward salad with fresh vegetables and a simple dressing.',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 0,
    difficulty: 'easy',
    mealTypes: ['lunch', 'dinner'],
    eligibleGroups: ['protein', 'fresh-vegetable'],
    slots: [
      { groups: ['protein'], fallbacks: ['chickpeas-cooked'], maximum: 1 },
      {
        groups: ['fresh-vegetable'],
        fallbacks: ['tomato-raw', 'cucumber-raw'],
        maximum: 2,
      },
    ],
    extras: [
      { id: 'lemon-juice', quantity: 1, unit: 'tablespoon' },
      { id: 'olive-oil', quantity: 1, unit: 'teaspoon' },
      { id: 'black-pepper', quantity: 0.25, unit: 'teaspoon', optional: true },
    ],
    steps: [
      'Cook the protein first if needed, then allow it to cool slightly.',
      'Chop the fresh vegetables into bite-sized pieces.',
      'Toss everything with lemon juice, olive oil, and optional pepper.',
    ],
  },
  {
    id: 'one-pan-skillet',
    titleSuffix: 'One-Pan Skillet',
    summary: 'A practical skillet meal pairing a protein with colorful vegetables.',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 20,
    difficulty: 'easy',
    mealTypes: ['lunch', 'dinner'],
    eligibleGroups: ['protein', 'vegetable', 'starchy-vegetable'],
    slots: [
      { groups: ['protein'], fallbacks: ['tofu-firm'], maximum: 1 },
      { groups: ['vegetable'], fallbacks: ['broccoli-raw'], maximum: 2 },
      { groups: ['starchy-vegetable'], fallbacks: ['sweet-potato-raw'], maximum: 1 },
    ],
    extras: [
      { id: 'olive-oil', quantity: 1, unit: 'tablespoon' },
      { id: 'garlic-raw', quantity: 1, unit: 'piece' },
      { id: 'black-pepper', quantity: 0.25, unit: 'teaspoon', optional: true },
    ],
    steps: [
      'Cut the protein and vegetables into even pieces.',
      'Warm the olive oil and cook the protein until safely done.',
      'Add the vegetables and garlic, then cook until tender.',
    ],
  },
  {
    id: 'quick-stir-fry',
    titleSuffix: 'Quick Stir-Fry',
    summary: 'A fast stir-fry with a protein, vegetables, and a modest grain portion.',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 15,
    difficulty: 'easy',
    mealTypes: ['lunch', 'dinner'],
    eligibleGroups: ['protein', 'vegetable', 'grain'],
    slots: [
      { groups: ['protein'], fallbacks: ['tofu-firm'], maximum: 1 },
      { groups: ['vegetable'], fallbacks: ['bell-pepper-raw'], maximum: 2 },
      { groups: ['grain'], fallbacks: ['brown-rice-cooked'], maximum: 1 },
    ],
    extras: [
      { id: 'olive-oil', quantity: 2, unit: 'teaspoon' },
      { id: 'garlic-raw', quantity: 1, unit: 'piece' },
      { id: 'ginger-raw', quantity: 1, unit: 'teaspoon' },
    ],
    steps: [
      'Prepare the protein, vegetables, and cooked grain.',
      'Stir-fry the protein in olive oil until safely done.',
      'Add the vegetables, garlic, and ginger; cook until crisp-tender and serve with the grain.',
    ],
  },
  {
    id: 'coconut-curry',
    titleSuffix: 'Coconut Curry',
    summary: 'A gently spiced curry with a protein, vegetables, and coconut milk.',
    servings: 3,
    prepMinutes: 10,
    cookMinutes: 25,
    difficulty: 'medium',
    mealTypes: ['lunch', 'dinner'],
    eligibleGroups: ['protein', 'vegetable'],
    slots: [
      { groups: ['protein'], fallbacks: ['chickpeas-cooked'], maximum: 1 },
      { groups: ['vegetable'], fallbacks: ['tomato-raw'], maximum: 2 },
    ],
    extras: [
      { id: 'onion-raw', quantity: 0.5, unit: 'piece' },
      { id: 'coconut-milk-canned', quantity: 0.5, unit: 'cup' },
      { id: 'cumin-ground', quantity: 1, unit: 'teaspoon' },
      { id: 'turmeric-ground', quantity: 0.5, unit: 'teaspoon' },
    ],
    steps: [
      'Prepare the protein and vegetables.',
      'Cook the onion and spices until fragrant.',
      'Add the remaining ingredients and simmer until safely cooked and tender.',
    ],
  },
  {
    id: 'hearty-soup',
    titleSuffix: 'Hearty Soup',
    summary: 'A comforting one-pot soup built around legumes and vegetables.',
    servings: 3,
    prepMinutes: 10,
    cookMinutes: 30,
    difficulty: 'easy',
    mealTypes: ['lunch', 'dinner'],
    eligibleGroups: ['legume', 'vegetable'],
    slots: [
      { groups: ['legume'], fallbacks: ['lentils-cooked'], maximum: 1 },
      { groups: ['vegetable'], fallbacks: ['carrot-raw', 'tomato-raw'], maximum: 2 },
    ],
    extras: [
      { id: 'onion-raw', quantity: 0.5, unit: 'piece' },
      { id: 'water', quantity: 2, unit: 'cup' },
      { id: 'cumin-ground', quantity: 0.5, unit: 'teaspoon' },
      { id: 'table-salt', quantity: 0.25, unit: 'teaspoon', optional: true },
    ],
    steps: [
      'Chop the vegetables and prepare the legumes.',
      'Combine the required ingredients with water in a pot.',
      'Simmer until the vegetables are tender, adding optional salt only if desired.',
    ],
  },
  {
    id: 'breakfast-scramble',
    titleSuffix: 'Breakfast Scramble',
    summary: 'A quick savory scramble with vegetables and whole-wheat toast.',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 10,
    difficulty: 'easy',
    mealTypes: ['breakfast'],
    eligibleGroups: ['scramble-protein', 'vegetable'],
    slots: [
      { groups: ['scramble-protein'], fallbacks: ['tofu-firm'], maximum: 1 },
      { groups: ['vegetable'], fallbacks: ['spinach-raw'], maximum: 2 },
    ],
    extras: [
      { id: 'whole-wheat-bread', quantity: 2, unit: 'piece' },
      { id: 'olive-oil', quantity: 1, unit: 'teaspoon' },
      { id: 'black-pepper', quantity: 0.25, unit: 'teaspoon', optional: true },
    ],
    steps: [
      'Prepare the scramble protein and vegetables.',
      'Cook them in olive oil until safely done and tender.',
      'Serve immediately with whole-wheat toast and optional pepper.',
    ],
  },
  {
    id: 'whole-wheat-wrap',
    titleSuffix: 'Whole-Wheat Wrap',
    summary: 'A portable whole-wheat wrap filled with a protein and crisp vegetables.',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 10,
    difficulty: 'easy',
    mealTypes: ['lunch', 'snack'],
    eligibleGroups: ['spreadable-protein', 'fresh-vegetable', 'wrap'],
    slots: [
      { groups: ['spreadable-protein'], fallbacks: ['black-beans-cooked'], maximum: 1 },
      {
        groups: ['fresh-vegetable'],
        fallbacks: ['tomato-raw', 'cucumber-raw'],
        maximum: 2,
      },
      { groups: ['wrap'], fallbacks: ['whole-wheat-tortilla'], maximum: 1 },
    ],
    extras: [{ id: 'lemon-juice', quantity: 1, unit: 'tablespoon' }],
    steps: [
      'Cook the protein if needed and prepare the vegetables.',
      'Arrange the filling over the whole-wheat tortillas.',
      'Finish with lemon juice, roll tightly, and serve.',
    ],
  },
  {
    id: 'oat-breakfast-bowl',
    titleSuffix: 'Oat Breakfast Bowl',
    summary: 'A simple oat bowl with fruit and a fiber-rich topping.',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 10,
    difficulty: 'easy',
    mealTypes: ['breakfast', 'snack'],
    eligibleGroups: ['breakfast-base', 'fruit', 'breakfast-topping'],
    slots: [
      { groups: ['breakfast-base'], fallbacks: ['rolled-oats-dry'], maximum: 1 },
      { groups: ['fruit'], fallbacks: ['banana-raw'], maximum: 1 },
      { groups: ['breakfast-topping'], fallbacks: ['chia-seeds'], maximum: 1 },
    ],
    extras: [{ id: 'water', quantity: 1, unit: 'cup' }],
    steps: [
      'Cook the oats with water until creamy.',
      'Prepare the fruit while the oats cook.',
      'Divide into bowls and add the fruit and topping.',
    ],
  },
  {
    id: 'open-toast',
    titleSuffix: 'Open Toast',
    summary: 'Whole-wheat toast topped with a protein and fresh produce.',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 5,
    difficulty: 'easy',
    mealTypes: ['breakfast', 'snack', 'lunch'],
    eligibleGroups: ['spreadable-protein', 'fresh-vegetable', 'fruit', 'bread'],
    slots: [
      {
        groups: ['spreadable-protein'],
        fallbacks: ['peanut-butter'],
        maximum: 1,
      },
      {
        groups: ['fresh-vegetable', 'fruit'],
        fallbacks: ['tomato-raw'],
        maximum: 1,
      },
      { groups: ['bread'], fallbacks: ['whole-wheat-bread'], maximum: 1 },
    ],
    extras: [],
    steps: [
      'Toast the whole-wheat bread.',
      'Prepare the topping ingredients.',
      'Layer the toppings over the toast and serve immediately.',
    ],
  },
];

export const bundledRecipeTemplates = Object.freeze(rawTemplates.map(freezeTemplate));
