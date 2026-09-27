import { FoodLog } from '../models/FoodLog.js';
import mongoose from 'mongoose';

const MANUAL_SOURCE = 'manual';

export async function createFoodLog(data) {
  return FoodLog.create(data);
}

export async function listOwnedFoodLogs({ userId, date, page, limit }) {
  const filter = {
    userId,
    source: MANUAL_SOURCE,
    ...(date ? { date } : {}),
  };
  const skip = (page - 1) * limit;

  const [foodLogs, total] = await Promise.all([
    FoodLog.find(filter)
      .sort({ date: -1, mealOrder: 1, createdAt: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodLog.countDocuments(filter),
  ]);

  return { foodLogs, total };
}

export function findOwnedFoodLog({ userId, foodLogId }) {
  return FoodLog.findOne({ _id: foodLogId, userId, source: MANUAL_SOURCE }).lean();
}

export function updateOwnedFoodLog({ userId, foodLogId, update }) {
  return FoodLog.findOneAndUpdate(
    { _id: foodLogId, userId, source: MANUAL_SOURCE },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  ).lean();
}

export function deleteOwnedFoodLog({ userId, foodLogId }) {
  return FoodLog.findOneAndDelete({ _id: foodLogId, userId, source: MANUAL_SOURCE }).lean();
}

export async function getOwnedDailyNutritionTotals({ userId, date }) {
  const [totals] = await FoodLog.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date,
        source: MANUAL_SOURCE,
      },
    },
    {
      $group: {
        _id: null,
        calories: { $sum: '$calories' },
        protein: { $sum: '$protein' },
        carbohydrates: { $sum: '$carbohydrates' },
        fat: { $sum: '$fat' },
        fiber: { $sum: '$fiber' },
        breakfastCalories: {
          $sum: { $cond: [{ $eq: ['$mealType', 'breakfast'] }, '$calories', 0] },
        },
        lunchCalories: {
          $sum: { $cond: [{ $eq: ['$mealType', 'lunch'] }, '$calories', 0] },
        },
        dinnerCalories: {
          $sum: { $cond: [{ $eq: ['$mealType', 'dinner'] }, '$calories', 0] },
        },
        snackCalories: {
          $sum: { $cond: [{ $eq: ['$mealType', 'snack'] }, '$calories', 0] },
        },
      },
    },
  ]);

  if (!totals) return null;
  return {
    calories: totals.calories,
    protein: totals.protein,
    carbohydrates: totals.carbohydrates,
    fat: totals.fat,
    fiber: totals.fiber,
    mealCalories: {
      breakfast: totals.breakfastCalories,
      lunch: totals.lunchCalories,
      dinner: totals.dinnerCalories,
      snack: totals.snackCalories,
    },
  };
}
