import { findBundledIngredient } from '../providers/nutrition/bundledNutritionProvider.js';

const dairyIngredientIds = new Set([
  'paneer',
  'greek-yogurt-plain',
  'milk-whole',
  'butter',
  'cheddar-cheese',
]);
const eggIngredientIds = new Set(['egg-whole']);
const meatIngredientIds = new Set(['chicken-breast-cooked']);

export function getBundledIngredientIdentity(name) {
  return findBundledIngredient(name)?.id || null;
}

export function getBundledDietClass(name) {
  const ingredientId = getBundledIngredientIdentity(name);
  if (!ingredientId) return null;
  if (meatIngredientIds.has(ingredientId)) return 'meat';
  if (eggIngredientIds.has(ingredientId)) return 'egg';
  if (dairyIngredientIds.has(ingredientId)) return 'dairy';
  return 'plant';
}

export function deriveDietaryTags(ingredients) {
  const dietClasses = ingredients.map((ingredient) => getBundledDietClass(ingredient.name));
  if (dietClasses.some((dietClass) => dietClass === null || dietClass === 'meat')) return [];
  if (dietClasses.includes('egg')) return ['eggetarian'];
  if (dietClasses.includes('dairy')) return ['vegetarian', 'eggetarian'];
  return ['vegetarian', 'eggetarian', 'vegan'];
}

export function satisfiesDietaryPreference(ingredients, preference) {
  if (preference === 'none') return true;
  return deriveDietaryTags(ingredients).includes(preference);
}
