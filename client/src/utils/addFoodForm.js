const nutritionFields = Object.freeze(['calories', 'protein', 'carbohydrates', 'fat', 'fiber']);

export function validateAddFoodDraft({
  mealType,
  selectedFood,
  quantity,
  unit,
  mode = 'catalog',
  customFood,
}) {
  const errors = {};
  const numericQuantity = Number(quantity);

  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
    errors.mealType = 'Choose breakfast, lunch, dinner, or snack.';
  }
  if (mode === 'catalog' && !selectedFood) {
    errors.foodId = 'Choose a food from the search results.';
  }
  if (mode === 'custom') {
    if (!customFood?.name?.trim()) errors.name = 'Enter a custom food name.';
    for (const field of nutritionFields) {
      const value = Number(customFood?.[field]);
      if (customFood?.[field] === '' || !Number.isFinite(value) || value < 0) {
        errors[field] = `Enter a valid ${field} value of 0 or more.`;
      }
    }
  }
  if (quantity === '' || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    errors.quantity = 'Enter a quantity greater than 0.';
  }

  const unitDefinition =
    mode === 'catalog'
      ? selectedFood?.supportedUnits.find((candidate) => candidate.unit === unit)
      : ['grams', 'milliliters', 'piece', 'serving'].includes(unit)
        ? { unit, label: unit, min: 0.01, max: 100000 }
        : null;
  if ((mode === 'custom' || selectedFood) && !unitDefinition) {
    errors.unit = 'Choose a supported unit for this food.';
  } else if (
    unitDefinition &&
    Number.isFinite(numericQuantity) &&
    (numericQuantity < unitDefinition.min || numericQuantity > unitDefinition.max)
  ) {
    errors.quantity = `Enter between ${unitDefinition.min} and ${unitDefinition.max} ${unitDefinition.label}.`;
  }

  return errors;
}

export function mapApiFieldErrors(error) {
  if (!Array.isArray(error?.details)) return {};

  return error.details.reduce((fields, detail) => {
    const field = detail.field === 'foodId' ? 'foodId' : detail.field;
    fields[field] = detail.message;
    return fields;
  }, {});
}

export function nutritionSnapshotsMatch(preview, savedFoodLog) {
  if (!preview?.nutrition || !savedFoodLog?.nutrition) return false;
  return nutritionFields.every(
    (nutrient) => preview.nutrition[nutrient] === savedFoodLog.nutrition[nutrient],
  );
}
