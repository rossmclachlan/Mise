import type { DateString, Horizon, Task } from '../types';
import { addDays, localDay, weekEnd, weekStart } from './dates';

/** How far ahead "This month" reaches, and how far "Taken care of" looks ahead. */
export const MONTH_DAYS = 28;

/**
 * The date that places an open task: the earliest of its do-by date (or its
 * deadline, when no do-by is set) and its open steps' dates.
 */
export function effectiveDate(task: Task): DateString | null {
  const dates: DateString[] = [];
  const own = task.do_by ?? task.deadline;
  if (own) dates.push(own);
  for (const step of task.steps) {
    if (!step.done_at && step.do_by) dates.push(step.do_by);
  }
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

export function horizonForDate(date: DateString, now: DateString): Horizon {
  if (date <= weekEnd(now)) return 'now';
  if (date <= addDays(now, MONTH_DAYS)) return 'month';
  return 'later';
}

/** Where an open task shows: dated tasks place themselves, undated ones stay where they were put. */
export function effectiveHorizon(task: Task, now: DateString): Horizon {
  const date = effectiveDate(task);
  return date ? horizonForDate(date, now) : task.horizon;
}

export function isOverdue(task: Task, now: DateString): boolean {
  const date = effectiveDate(task);
  return !task.done_at && date !== null && date < now;
}

/**
 * The fields to write when someone moves a task to a horizon by hand. A dated
 * task's date is what places it, so moving it means moving its do-by date.
 */
export function moveToHorizon(task: Task, to: Horizon, now: DateString): Partial<Task> {
  const dated = effectiveDate(task) !== null;
  if (!dated) return { horizon: to };
  const nextMonday = addDays(weekStart(now), 7);
  switch (to) {
    case 'now':
      return { horizon: to, do_by: now };
    case 'month':
      return { horizon: to, do_by: nextMonday };
    case 'later':
      return { horizon: to, do_by: addDays(now, MONTH_DAYS + 7) };
  }
}

/** Done, with its date still ahead: shown under Taken care of. */
export function isComingUp(task: Task, now: DateString): boolean {
  return task.done_at !== null && task.when !== null && task.when >= now;
}

/** Taken care of, on the home screen: coming up within the next four weeks. */
export function isTakenCareOfSoon(task: Task, now: DateString): boolean {
  return isComingUp(task, now) && task.when! <= addDays(now, MONTH_DAYS);
}

export function isDoneThisWeek(task: Task, now: DateString): boolean {
  return task.done_at !== null && localDay(task.done_at) >= weekStart(now);
}
