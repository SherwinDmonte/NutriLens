export const MEAL_SECTION_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'breakfast', label: 'Breakfast', emptyLabel: 'No breakfast logged yet.' }),
  Object.freeze({ key: 'lunch', label: 'Lunch', emptyLabel: 'No lunch logged yet.' }),
  Object.freeze({ key: 'dinner', label: 'Dinner', emptyLabel: 'No dinner logged yet.' }),
  Object.freeze({ key: 'snack', label: 'Snacks', emptyLabel: 'No snacks logged yet.' }),
]);

const mealKeys = new Set(MEAL_SECTION_DEFINITIONS.map((meal) => meal.key));

export function buildMealSections(foodLogs, mealCalories = {}) {
  const entriesByMeal = Object.fromEntries(MEAL_SECTION_DEFINITIONS.map((meal) => [meal.key, []]));

  for (const foodLog of foodLogs) {
    if (!mealKeys.has(foodLog.mealType)) {
      throw new Error(`Unsupported meal type: ${foodLog.mealType}`);
    }
    entriesByMeal[foodLog.mealType].push(foodLog);
  }

  return MEAL_SECTION_DEFINITIONS.map((meal) => ({
    ...meal,
    entries: entriesByMeal[meal.key],
    subtotalCalories: Number.isFinite(mealCalories[meal.key]) ? mealCalories[meal.key] : 0,
  }));
}

export function formatFoodQuantity(quantity, unit) {
  const formattedQuantity = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 3,
  }).format(quantity);
  const unitLabels = {
    grams: 'g',
    milliliters: 'ml',
    piece: quantity === 1 ? 'piece' : 'pieces',
    serving: quantity === 1 ? 'serving' : 'servings',
  };

  return `${formattedQuantity} ${unitLabels[unit] || unit}`;
}
