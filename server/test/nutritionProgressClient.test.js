import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getFiberIntake,
  getNutrientProgress,
  TRACKED_NUTRIENTS,
} from '../../client/src/utils/nutritionProgress.js';
import { calculateDailySummary } from '../src/services/dailySummaryService.js';

const date = '2026-08-27';

test('progress view data exactly reflects a normal server summary', () => {
  const summary = calculateDailySummary({
    date,
    rawTotals: { calories: 1012.04, protein: 52, carbohydrates: 125, fat: 31, fiber: 18 },
  });
  const calories = getNutrientProgress(summary, 'calories');

  assert.deepEqual(calories, {
    consumed: 1012,
    target: 2000,
    remaining: 988,
    percentage: 50.6,
    visualPercentage: 50.6,
    overTarget: 0,
    unit: 'kcal',
    isOverTarget: false,
    isTargetReached: false,
    statusText: '988 kcal remaining',
    progressText: '50.6% complete',
  });
});

test('exact targets receive an explicit reached state', () => {
  const summary = calculateDailySummary({
    date,
    rawTotals: { calories: 2000, protein: 100, carbohydrates: 250, fat: 67, fiber: 20 },
  });

  for (const nutrient of TRACKED_NUTRIENTS) {
    const progress = getNutrientProgress(summary, nutrient);
    assert.equal(progress.percentage, 100);
    assert.equal(progress.visualPercentage, 100);
    assert.equal(progress.remaining, 0);
    assert.equal(progress.isTargetReached, true);
    assert.equal(progress.isOverTarget, false);
    assert.equal(progress.statusText, 'Daily target reached');
  }
});

test('over-target data preserves actual percentages while capping only visual progress', () => {
  const summary = calculateDailySummary({
    date,
    rawTotals: { calories: 2500, protein: 112, carbohydrates: 300, fat: 100, fiber: 25 },
  });
  const carbohydrates = getNutrientProgress(summary, 'carbohydrates');

  assert.equal(carbohydrates.percentage, 120);
  assert.equal(carbohydrates.visualPercentage, 100);
  assert.equal(carbohydrates.remaining, 0);
  assert.equal(carbohydrates.overTarget, 50);
  assert.equal(carbohydrates.isOverTarget, true);
  assert.equal(carbohydrates.statusText, '50 g over target');
  assert.equal(carbohydrates.progressText, '120% complete');
});

test('empty summaries show zero consumed and the complete target remaining', () => {
  const summary = calculateDailySummary({ date, rawTotals: null });

  for (const nutrient of TRACKED_NUTRIENTS) {
    const progress = getNutrientProgress(summary, nutrient);
    assert.equal(progress.consumed, 0);
    assert.equal(progress.remaining, progress.target);
    assert.equal(progress.percentage, 0);
    assert.equal(progress.visualPercentage, 0);
  }
});

test('fiber is represented as consumed-only data with no implied target', () => {
  const summary = calculateDailySummary({ date, rawTotals: { fiber: 18.126 } });

  assert.deepEqual(getFiberIntake(summary), { consumed: 18.13, unit: 'g', target: null });
});
