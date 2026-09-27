export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function dateParts(calendarDate) {
  if (!CALENDAR_DATE_PATTERN.test(calendarDate)) {
    throw new Error('Calendar date must use YYYY-MM-DD.');
  }

  const [year, month, day] = calendarDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Calendar date must be a real date.');
  }

  return { year, month, day };
}

export function isValidCalendarDate(calendarDate) {
  try {
    dateParts(calendarDate);
    return true;
  } catch {
    return false;
  }
}

export function resolveCalendarDate(calendarDate, fallbackDate) {
  return isValidCalendarDate(calendarDate) ? calendarDate : fallbackDate;
}

export function toCalendarDate(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function getTodayCalendarDate(now = new Date()) {
  return toCalendarDate(now);
}

export function isFutureCalendarDate(calendarDate, today = getTodayCalendarDate()) {
  dateParts(calendarDate);
  dateParts(today);
  return calendarDate > today;
}

export function shiftCalendarDate(calendarDate, dayOffset) {
  const { year, month, day } = dateParts(calendarDate);
  const shifted = new Date(Date.UTC(year, month - 1, day + dayOffset));
  return `${shifted.getUTCFullYear()}-${padDatePart(shifted.getUTCMonth() + 1)}-${padDatePart(shifted.getUTCDate())}`;
}

export function formatCalendarDate(calendarDate, locale = 'en-US') {
  const { year, month, day } = dateParts(calendarDate);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
