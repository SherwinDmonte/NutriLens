export const MEAL_TYPES = Object.freeze(['breakfast', 'lunch', 'dinner', 'snack']);

export const MEAL_ORDER = Object.freeze(
  Object.fromEntries(MEAL_TYPES.map((mealType, index) => [mealType, index])),
);

export const FOOD_LOG_UNITS = Object.freeze(['grams', 'milliliters', 'piece', 'serving']);
