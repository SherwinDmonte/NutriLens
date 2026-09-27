import mongoose from 'mongoose';

import { FOOD_LOG_UNITS, MEAL_ORDER, MEAL_TYPES } from '../config/foodLogs.js';
import { isCanonicalCalendarDate } from '../utils/calendarDate.js';

const nonNegativeNutritionField = (label) => ({
  type: Number,
  required: [true, `${label} is required.`],
  min: [0, `${label} cannot be negative.`],
  max: [1_000_000, `${label} is too large.`],
});

const nutritionSnapshotSchema = new mongoose.Schema(
  {
    calories: nonNegativeNutritionField('Calories'),
    protein: nonNegativeNutritionField('Protein'),
    carbohydrates: nonNegativeNutritionField('Carbohydrates'),
    fat: nonNegativeNutritionField('Fat'),
    fiber: nonNegativeNutritionField('Fiber'),
  },
  { _id: false },
);

const servingSchema = new mongoose.Schema(
  {
    quantity: { type: Number, required: true, min: 0.01, max: 100_000 },
    unit: { type: String, required: true, enum: FOOD_LOG_UNITS },
  },
  { _id: false },
);

const supportedUnitSchema = new mongoose.Schema(
  {
    unit: { type: String, required: true, enum: FOOD_LOG_UNITS },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    referenceQuantityPerUnit: { type: Number, required: true, min: 0.0001, max: 100_000 },
    defaultQuantity: { type: Number, required: true, min: 0.0001, max: 100_000 },
    step: { type: Number, required: true, min: 0.0001, max: 100_000 },
    min: { type: Number, required: true, min: 0.0001, max: 100_000 },
    max: { type: Number, required: true, min: 0.0001, max: 100_000 },
  },
  { _id: false },
);

const foodSourceSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ['usda', 'open_food_facts', 'custom', 'legacy'],
    },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    externalId: { type: String, required: true, trim: true, maxlength: 80 },
    dataType: { type: String, required: true, trim: true, maxlength: 80 },
    license: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const catalogSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 240 },
    category: { type: String, default: '', trim: true, maxlength: 120 },
    imageUrl: { type: String, default: null, trim: true, maxlength: 1000 },
    baseServing: { type: servingSchema, required: true },
    supportedUnits: {
      type: [supportedUnitSchema],
      required: true,
      validate: {
        validator: (units) => Array.isArray(units) && units.length > 0 && units.length <= 8,
        message: 'At least one supported food unit is required.',
      },
    },
    nutrition: { type: nutritionSnapshotSchema, required: true },
    missingNutrients: {
      type: [String],
      default: [],
      enum: ['calories', 'protein', 'carbohydrates', 'fat', 'fiber'],
    },
    source: { type: foodSourceSchema, required: true },
  },
  { _id: false },
);

const foodLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required.'],
      immutable: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required.'],
      validate: {
        validator: isCanonicalCalendarDate,
        message: 'Date must be a real calendar date in YYYY-MM-DD format.',
      },
    },
    mealType: {
      type: String,
      required: [true, 'Meal type is required.'],
      enum: {
        values: MEAL_TYPES,
        message: 'Meal type must be breakfast, lunch, dinner, or snack.',
      },
    },
    mealOrder: {
      type: Number,
      required: true,
      min: 0,
      max: MEAL_TYPES.length - 1,
      select: false,
    },
    foodCatalogId: {
      type: String,
      required: [true, 'Food catalog ID is required.'],
      trim: true,
      maxlength: [80, 'Food catalog ID cannot exceed 80 characters.'],
    },
    foodName: {
      type: String,
      required: [true, 'Food name is required.'],
      trim: true,
      minlength: [1, 'Food name is required.'],
      maxlength: [120, 'Food name cannot exceed 120 characters.'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required.'],
      min: [0.01, 'Quantity must be greater than 0.'],
      max: [100_000, 'Quantity is too large.'],
    },
    unit: {
      type: String,
      required: [true, 'Unit is required.'],
      enum: {
        values: FOOD_LOG_UNITS,
        message: 'Unit is not supported.',
      },
    },
    calories: nonNegativeNutritionField('Calories'),
    protein: nonNegativeNutritionField('Protein'),
    carbohydrates: nonNegativeNutritionField('Carbohydrates'),
    fat: nonNegativeNutritionField('Fat'),
    fiber: {
      ...nonNegativeNutritionField('Fiber'),
      default: 0,
    },
    catalogSnapshot: {
      type: catalogSnapshotSchema,
      required: false,
    },
    source: {
      type: String,
      required: true,
      enum: {
        values: ['manual', 'ai'],
        message: 'Source must be manual or ai.',
      },
      default: 'manual',
    },
  },
  {
    autoCreate: false,
    autoIndex: false,
    collection: 'foodlogs',
    timestamps: true,
    versionKey: false,
  },
);

foodLogSchema.pre('validate', function setMealOrder() {
  this.mealOrder = MEAL_ORDER[this.mealType];
});

foodLogSchema.index(
  { userId: 1, date: 1, mealType: 1, createdAt: 1 },
  { name: 'foodlogs_by_user_date_meal' },
);

foodLogSchema.index(
  { userId: 1, date: 1, source: 1 },
  { name: 'foodlogs_summary_by_user_date_source' },
);

foodLogSchema.index(
  { userId: 1, source: 1, date: -1, mealOrder: 1, createdAt: 1, _id: 1 },
  { name: 'foodlogs_owned_history_order' },
);

export const FoodLog = mongoose.models.FoodLog || mongoose.model('FoodLog', foodLogSchema);
