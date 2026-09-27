import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMealSections, formatFoodQuantity } from '../../client/src/utils/mealSections.js';

function foodLog(id, mealType) {
  return {
    id,
    mealType,
    foodName: `Food ${id}`,
    quantity: 1,
    unit: 'serving',
    nutrition: { calories: 100, protein: 1, carbohydrates: 2, fat: 3, fiber: 4 },
  };
}

test('meal sections always use breakfast, lunch, dinner, and snack order', () => {
  const sections = buildMealSections(
    [foodLog('dinner-1', 'dinner'), foodLog('breakfast-1', 'breakfast')],
    { breakfast: 120, lunch: 0, dinner: 340, snack: 0 },
  );

  assert.deepEqual(
    sections.map((section) => section.key),
    ['breakfast', 'lunch', 'dinner', 'snack'],
  );
  assert.deepEqual(
    sections.map((section) => section.subtotalCalories),
    [120, 0, 340, 0],
  );
});

test('every entry appears in exactly one meal while preserving within-meal order', () => {
  const logs = [
    foodLog('lunch-1', 'lunch'),
    foodLog('breakfast-1', 'breakfast'),
    foodLog('lunch-2', 'lunch'),
    foodLog('snack-1', 'snack'),
  ];
  const sections = buildMealSections(logs);
  const flattenedIds = sections.flatMap((section) => section.entries.map((entry) => entry.id));

  assert.equal(flattenedIds.length, logs.length);
  assert.equal(new Set(flattenedIds).size, logs.length);
  assert.deepEqual(
    sections.find((section) => section.key === 'lunch').entries.map((entry) => entry.id),
    ['lunch-1', 'lunch-2'],
  );
});

test('empty and dense days retain all four sections and all entries', () => {
  const emptySections = buildMealSections([], {});
  assert.equal(emptySections.length, 4);
  assert.equal(
    emptySections.every((section) => section.entries.length === 0),
    true,
  );
  assert.equal(
    emptySections.every((section) => section.subtotalCalories === 0),
    true,
  );

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const denseLogs = Array.from({ length: 80 }, (_, index) =>
    foodLog(`entry-${index}`, mealTypes[index % mealTypes.length]),
  );
  const denseSections = buildMealSections(denseLogs);
  assert.equal(
    denseSections.reduce((total, section) => total + section.entries.length, 0),
    80,
  );
  assert.equal(
    denseSections.every((section) => section.entries.length === 20),
    true,
  );
});

test('food quantity labels use compact, readable units', () => {
  assert.equal(formatFoodQuantity(100, 'grams'), '100 g');
  assert.equal(formatFoodQuantity(250, 'milliliters'), '250 ml');
  assert.equal(formatFoodQuantity(1, 'piece'), '1 piece');
  assert.equal(formatFoodQuantity(2, 'piece'), '2 pieces');
  assert.equal(formatFoodQuantity(1.25, 'serving'), '1.25 servings');
});

test('unsupported meal data fails instead of being silently dropped', () => {
  assert.throws(() => buildMealSections([foodLog('bad', 'brunch')]), /Unsupported meal type/);
});

test('a refreshed edit snapshot moves the same entry and replaces its meal contribution', () => {
  const original = foodLog('editable', 'lunch');
  const updated = {
    ...original,
    mealType: 'dinner',
    foodName: 'Rice',
    quantity: 200,
    unit: 'grams',
    nutrition: { calories: 260, protein: 5.4, carbohydrates: 56.4, fat: 0.6, fiber: 0.8 },
  };
  const sections = buildMealSections([updated], {
    breakfast: 0,
    lunch: 0,
    dinner: 260,
    snack: 0,
  });

  assert.equal(sections.find((section) => section.key === 'lunch').entries.length, 0);
  assert.deepEqual(sections.find((section) => section.key === 'dinner').entries, [updated]);
  assert.equal(sections.find((section) => section.key === 'dinner').subtotalCalories, 260);
  assert.equal(
    sections.flatMap((section) => section.entries).filter((entry) => entry.id === original.id)
      .length,
    1,
  );
});

test('a refreshed delete snapshot removes the entry and its complete meal subtotal', () => {
  const remaining = foodLog('remaining', 'breakfast');
  const sections = buildMealSections([remaining], {
    breakfast: 100,
    lunch: 0,
    dinner: 0,
    snack: 0,
  });

  assert.deepEqual(
    sections.flatMap((section) => section.entries.map((entry) => entry.id)),
    ['remaining'],
  );
  assert.equal(
    sections.reduce((total, section) => total + section.subtotalCalories, 0),
    100,
  );
});
