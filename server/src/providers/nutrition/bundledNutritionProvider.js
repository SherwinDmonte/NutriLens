import {
  BUNDLED_NUTRITION_CALCULATION_METHOD,
  BUNDLED_NUTRITION_DATA_VERSION,
  BUNDLED_NUTRITION_DATASET,
  ingredientNutritionCatalog,
} from '../../data/ingredientNutrition.js';
import {
  canConvertRecipeUnits,
  convertRecipeQuantity,
  normalizeRecipeUnit,
} from '../../utils/recipeUnits.js';

const nutrientNames = Object.freeze(['calories', 'protein', 'carbohydrates', 'fat', 'fiber']);

function normalizeLookupName(value) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

function buildIngredientIndex(catalog) {
  const index = new Map();

  for (const ingredient of catalog) {
    for (const lookupName of [ingredient.name, ...ingredient.aliases]) {
      const normalizedName = normalizeLookupName(lookupName);
      const existing = index.get(normalizedName);
      if (existing && existing.id !== ingredient.id) {
        throw new Error(`Bundled nutrition alias "${normalizedName}" is assigned more than once.`);
      }
      index.set(normalizedName, ingredient);
    }
  }

  return index;
}

const ingredientIndex = buildIngredientIndex(ingredientNutritionCatalog);

const provenance = Object.freeze({
  dataset: BUNDLED_NUTRITION_DATASET,
  version: BUNDLED_NUTRITION_DATA_VERSION,
  calculationMethod: BUNDLED_NUTRITION_CALCULATION_METHOD,
});

function unmatchedEstimate({ inputName, reason, requestedQuantity, requestedUnit }) {
  return {
    status: 'unmatched',
    inputName,
    reason,
    requested: { quantity: requestedQuantity ?? null, unit: requestedUnit ?? null },
    confidenceScore: 0,
    assumptions: [],
    provenance,
  };
}

function resolveBaseQuantity(ingredient, quantity, unit) {
  if (canConvertRecipeUnits(unit, ingredient.reference.unit)) {
    return {
      baseQuantity: convertRecipeQuantity(quantity, unit, ingredient.reference.unit),
      usedIngredientSpecificConversion: false,
    };
  }

  const baseQuantityPerUnit = ingredient.conversions[unit];
  if (!Number.isFinite(baseQuantityPerUnit) || baseQuantityPerUnit <= 0) return null;

  return {
    baseQuantity: quantity * baseQuantityPerUnit,
    usedIngredientSpecificConversion: true,
  };
}

export function findBundledIngredient(inputName) {
  if (typeof inputName !== 'string' || inputName.trim().length === 0) return null;
  return ingredientIndex.get(normalizeLookupName(inputName)) || null;
}

export function estimateBundledIngredient({ name, quantity, unit }) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new TypeError('Ingredient name is required for nutrition estimation.');
  }
  if (
    quantity !== undefined &&
    quantity !== null &&
    (!Number.isFinite(quantity) || quantity <= 0)
  ) {
    throw new TypeError('Ingredient quantity must be a finite number greater than 0.');
  }

  const inputName = normalizeLookupName(name);
  const ingredient = findBundledIngredient(inputName);
  const normalizedRequestedUnit = normalizeRecipeUnit(unit);

  if (!ingredient) {
    return unmatchedEstimate({
      inputName,
      reason: 'unknown_ingredient',
      requestedQuantity: quantity,
      requestedUnit: normalizedRequestedUnit === null ? unit : normalizedRequestedUnit,
    });
  }

  let resolvedQuantity = quantity;
  let resolvedUnit = normalizedRequestedUnit;
  let confidenceScore = 100;
  const assumptions = [];

  if (resolvedQuantity === undefined || resolvedQuantity === null) {
    resolvedQuantity = ingredient.defaultMeasure.quantity;
    resolvedUnit = ingredient.defaultMeasure.unit;
    confidenceScore = 65;
    assumptions.push({
      code: 'default_quantity',
      message: `Used the bundled default amount of ${resolvedQuantity} ${resolvedUnit}.`,
    });
  } else if (resolvedUnit === undefined) {
    resolvedUnit = ingredient.defaultMeasure.unit;
    confidenceScore = 75;
    assumptions.push({
      code: 'default_unit',
      message: `Interpreted the provided quantity in ${resolvedUnit}.`,
    });
  }

  if (resolvedUnit === null) {
    return unmatchedEstimate({
      inputName,
      reason: 'unsupported_conversion',
      requestedQuantity: quantity,
      requestedUnit: unit,
    });
  }

  const conversion = resolveBaseQuantity(ingredient, resolvedQuantity, resolvedUnit);
  if (!conversion) {
    return unmatchedEstimate({
      inputName,
      reason: 'unsupported_conversion',
      requestedQuantity: quantity,
      requestedUnit: resolvedUnit,
    });
  }

  if (conversion.usedIngredientSpecificConversion) {
    confidenceScore = Math.min(confidenceScore, 90);
    assumptions.push({
      code: 'ingredient_specific_conversion',
      message: `Converted ${resolvedUnit} using the bundled ${ingredient.name} measure.`,
    });
  }

  const scale = conversion.baseQuantity / ingredient.reference.quantity;
  const nutrition = Object.fromEntries(
    nutrientNames.map((nutrient) => [nutrient, ingredient.nutrition[nutrient] * scale]),
  );

  return {
    status: 'matched',
    ingredientId: ingredient.id,
    inputName,
    canonicalName: ingredient.name,
    requested: { quantity: quantity ?? null, unit: normalizedRequestedUnit ?? null },
    resolved: {
      quantity: resolvedQuantity,
      unit: resolvedUnit,
      baseQuantity: conversion.baseQuantity,
      baseUnit: ingredient.reference.unit,
    },
    nutrition,
    confidenceScore,
    assumptions,
    provenance,
  };
}

export const bundledNutritionProvider = Object.freeze({
  name: 'bundled',
  provenance,
  estimateIngredient: estimateBundledIngredient,
});
