export const TRACKED_NUTRIENTS = Object.freeze(['calories', 'protein', 'carbohydrates', 'fat']);

const nutrientUnits = Object.freeze({
  calories: 'kcal',
  protein: 'g',
  carbohydrates: 'g',
  fat: 'g',
  fiber: 'g',
});

export function formatNutritionNumber(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function getNutrientProgress(summary, nutrient) {
  if (!TRACKED_NUTRIENTS.includes(nutrient)) {
    throw new Error(`Unsupported target nutrient: ${nutrient}`);
  }

  const unit = nutrientUnits[nutrient];
  const consumed = summary.consumed[nutrient];
  const target = summary.targets[nutrient];
  const remaining = summary.remaining[nutrient];
  const percentage = summary.completionPercentage[nutrient];
  const visualPercentage = summary.visualCompletionPercentage[nutrient];
  const overTarget = summary.overTarget[nutrient];
  const isOverTarget = overTarget > 0;
  const isTargetReached = !isOverTarget && percentage === 100;

  return {
    consumed,
    target,
    remaining,
    percentage,
    visualPercentage,
    overTarget,
    unit,
    isOverTarget,
    isTargetReached,
    statusText: isOverTarget
      ? `${formatNutritionNumber(overTarget)} ${unit} over target`
      : isTargetReached
        ? 'Daily target reached'
        : `${formatNutritionNumber(remaining)} ${unit} remaining`,
    progressText: `${formatNutritionNumber(percentage)}% complete`,
  };
}

export function getFiberIntake(summary) {
  return {
    consumed: summary.consumed.fiber,
    unit: nutrientUnits.fiber,
    target: null,
  };
}
