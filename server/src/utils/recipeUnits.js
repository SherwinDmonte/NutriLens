import { RECIPE_UNITS } from '../config/recipes.js';

const unitDefinitions = Object.freeze({
  grams: Object.freeze({ dimension: 'mass', baseFactor: 1 }),
  kilograms: Object.freeze({ dimension: 'mass', baseFactor: 1_000 }),
  milliliters: Object.freeze({ dimension: 'volume', baseFactor: 1 }),
  liters: Object.freeze({ dimension: 'volume', baseFactor: 1_000 }),
  teaspoon: Object.freeze({ dimension: 'volume', baseFactor: 5 }),
  tablespoon: Object.freeze({ dimension: 'volume', baseFactor: 15 }),
  cup: Object.freeze({ dimension: 'volume', baseFactor: 240 }),
  piece: Object.freeze({ dimension: 'count', baseFactor: 1 }),
  serving: Object.freeze({ dimension: 'serving', baseFactor: 1 }),
});

const unitAliases = new Map([
  ['g', 'grams'],
  ['gram', 'grams'],
  ['grams', 'grams'],
  ['kg', 'kilograms'],
  ['kilogram', 'kilograms'],
  ['kilograms', 'kilograms'],
  ['ml', 'milliliters'],
  ['milliliter', 'milliliters'],
  ['milliliters', 'milliliters'],
  ['l', 'liters'],
  ['liter', 'liters'],
  ['liters', 'liters'],
  ['tsp', 'teaspoon'],
  ['teaspoon', 'teaspoon'],
  ['teaspoons', 'teaspoon'],
  ['tbsp', 'tablespoon'],
  ['tablespoon', 'tablespoon'],
  ['tablespoons', 'tablespoon'],
  ['cup', 'cup'],
  ['cups', 'cup'],
  ['piece', 'piece'],
  ['pieces', 'piece'],
  ['serving', 'serving'],
  ['servings', 'serving'],
]);

export function normalizeRecipeUnit(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  return unitAliases.get(value.trim().toLocaleLowerCase('en-US')) || null;
}

export function getRecipeUnitDimension(unit) {
  return unitDefinitions[unit]?.dimension || null;
}

export function canConvertRecipeUnits(fromUnit, toUnit) {
  const fromDefinition = unitDefinitions[fromUnit];
  const toDefinition = unitDefinitions[toUnit];
  return Boolean(
    fromDefinition && toDefinition && fromDefinition.dimension === toDefinition.dimension,
  );
}

export function convertRecipeQuantity(quantity, fromUnit, toUnit) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new RangeError('Recipe quantity must be a finite number greater than 0.');
  }

  if (!RECIPE_UNITS.includes(fromUnit) || !RECIPE_UNITS.includes(toUnit)) {
    throw new RangeError('Recipe units must use supported canonical values.');
  }

  if (!canConvertRecipeUnits(fromUnit, toUnit)) {
    throw new RangeError(`Cannot convert ${fromUnit} to ${toUnit}.`);
  }

  const baseQuantity = quantity * unitDefinitions[fromUnit].baseFactor;
  return baseQuantity / unitDefinitions[toUnit].baseFactor;
}
