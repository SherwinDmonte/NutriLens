import { MEAL_TYPES } from '../config/foodLogs.js';
import { DEFAULT_DAILY_TARGETS } from '../config/nutritionTargets.js';
import * as defaultRepository from '../repositories/foodLogRepository.js';
import { roundNutrientValue } from './foodCatalogService.js';

const TARGETED_NUTRIENTS = Object.freeze(['calories', 'protein', 'carbohydrates', 'fat']);
const ALL_NUTRIENTS = Object.freeze([...TARGETED_NUTRIENTS, 'fiber']);

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function roundPercentage(value) {
  return Number(value.toFixed(1));
}

function normalizeConsumed(rawTotals = {}) {
  const totals = rawTotals || {};
  return Object.fromEntries(
    ALL_NUTRIENTS.map((nutrient) => [
      nutrient,
      roundNutrientValue(nutrient, finiteOrZero(totals[nutrient])),
    ]),
  );
}

function normalizeMealCalories(rawTotals = {}) {
  const totals = rawTotals || {};
  return Object.fromEntries(
    MEAL_TYPES.map((mealType) => [
      mealType,
      roundNutrientValue('calories', finiteOrZero(totals.mealCalories?.[mealType])),
    ]),
  );
}

export function calculateDailySummary({ date, rawTotals, targets = DEFAULT_DAILY_TARGETS }) {
  const consumed = normalizeConsumed(rawTotals);
  const remaining = {};
  const completionPercentage = {};
  const visualCompletionPercentage = {};
  const overTarget = {};

  for (const nutrient of TARGETED_NUTRIENTS) {
    const target = targets[nutrient];
    const actualPercentage = roundPercentage((consumed[nutrient] / target) * 100);
    remaining[nutrient] = roundNutrientValue(nutrient, Math.max(target - consumed[nutrient], 0));
    completionPercentage[nutrient] = actualPercentage;
    visualCompletionPercentage[nutrient] = Math.min(actualPercentage, 100);
    overTarget[nutrient] = roundNutrientValue(nutrient, Math.max(consumed[nutrient] - target, 0));
  }

  return {
    date,
    targets: { ...targets },
    consumed,
    remaining,
    completionPercentage,
    visualCompletionPercentage,
    overTarget,
    mealCalories: normalizeMealCalories(rawTotals),
  };
}

export async function getDailyNutritionSummary(
  { authenticatedUserId, date },
  { repository = defaultRepository } = {},
) {
  const rawTotals = await repository.getOwnedDailyNutritionTotals({
    userId: authenticatedUserId,
    date,
  });
  return calculateDailySummary({ date, rawTotals });
}
