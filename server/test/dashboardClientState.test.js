import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCalendarDate,
  getTodayCalendarDate,
  isFutureCalendarDate,
  resolveCalendarDate,
  shiftCalendarDate,
} from '../../client/src/utils/calendarDate.js';
import {
  isCurrentDashboardSnapshot,
  shouldRefreshDashboardDate,
} from '../../client/src/utils/dashboardSnapshot.js';

test('calendar dates use local date parts without an implicit UTC conversion', () => {
  const lateLocalTime = new Date(2026, 7, 27, 23, 59, 59);

  assert.equal(getTodayCalendarDate(lateLocalTime), '2026-08-27');
});

test('calendar navigation crosses month, year, and leap-day boundaries', () => {
  assert.equal(shiftCalendarDate('2024-02-28', 1), '2024-02-29');
  assert.equal(shiftCalendarDate('2024-02-29', 1), '2024-03-01');
  assert.equal(shiftCalendarDate('2026-01-01', -1), '2025-12-31');
});

test('calendar formatting preserves the selected date', () => {
  assert.equal(formatCalendarDate('2026-08-27', 'en-US'), 'Thursday, August 27, 2026');
  assert.throws(() => shiftCalendarDate('2026-02-30', 1), /real date/);
});

test('dashboard dates restore from valid URLs and otherwise default predictably to today', () => {
  const today = '2026-08-27';

  assert.equal(resolveCalendarDate('2024-02-29', today), '2024-02-29');
  assert.equal(resolveCalendarDate(null, today), today);
  assert.equal(resolveCalendarDate('2026-02-30', today), today);
});

test('past and future dates are explicitly distinguishable for the planning policy', () => {
  const today = '2026-08-27';

  assert.equal(isFutureCalendarDate('2026-08-28', today), true);
  assert.equal(isFutureCalendarDate(today, today), false);
  assert.equal(isFutureCalendarDate('2026-08-26', today), false);
});

test('dashboard snapshots cannot cross dates, retries, or accounts', () => {
  const snapshot = {
    userId: 'user-a',
    date: '2026-08-27',
    requestToken: 2,
  };

  assert.equal(
    isCurrentDashboardSnapshot(snapshot, {
      userId: 'user-a',
      selectedDate: '2026-08-27',
      requestToken: 2,
    }),
    true,
  );
  assert.equal(
    isCurrentDashboardSnapshot(snapshot, {
      userId: 'user-a',
      selectedDate: '2026-08-28',
      requestToken: 2,
    }),
    false,
  );
  assert.equal(
    isCurrentDashboardSnapshot(snapshot, {
      userId: 'user-b',
      selectedDate: '2026-08-27',
      requestToken: 2,
    }),
    false,
  );
  assert.equal(
    isCurrentDashboardSnapshot(snapshot, {
      userId: 'user-a',
      selectedDate: '2026-08-27',
      requestToken: 3,
    }),
    false,
  );
});

test('mutations refresh only the dashboard date they affected', () => {
  assert.equal(shouldRefreshDashboardDate('2026-08-27', '2026-08-27'), true);
  assert.equal(shouldRefreshDashboardDate('2026-08-26', '2026-08-27'), false);
});
