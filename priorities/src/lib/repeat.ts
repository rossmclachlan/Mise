import type { DateString, RepeatRule } from '../types';
import { addDays, addMonths } from './dates';

function step(date: DateString, rule: RepeatRule): DateString {
  switch (rule.unit) {
    case 'day':
      return addDays(date, rule.every);
    case 'week':
      return addDays(date, rule.every * 7);
    case 'month':
      return addMonths(date, rule.every);
    case 'year':
      return addMonths(date, rule.every * 12);
  }
}

/**
 * The next occurrence's date.
 *  - schedule: steps from the occurrence's own date, skipping any dates that
 *    have already passed, so trash night stays on Thursdays.
 *  - after_done: steps from the day it was actually done.
 */
export function nextOccurrence(
  rule: RepeatRule,
  dueDate: DateString | null,
  doneOn: DateString,
): DateString {
  if (rule.mode === 'after_done' || !dueDate) return step(doneOn, rule);
  let next = step(dueDate, rule);
  while (next <= doneOn) next = step(next, rule);
  return next;
}

/** Days between two dates, used to keep a deadline the same distance from its do-by date. */
export function daysBetween(a: DateString, b: DateString): number {
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime();
  return Math.round(ms / 86_400_000);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "every Thu", "every 3 months after done", "every year". */
export function describeRepeat(rule: RepeatRule, date?: DateString | null): string {
  if (rule.unit === 'week' && rule.every === 1 && rule.mode === 'schedule' && date) {
    return `every ${WEEKDAYS[new Date(date + 'T12:00:00').getDay()]}`;
  }
  const unit = rule.every === 1 ? rule.unit : `${rule.every} ${rule.unit}s`;
  const base = `every ${unit}`;
  return rule.mode === 'after_done' ? `${base} after done` : base;
}
