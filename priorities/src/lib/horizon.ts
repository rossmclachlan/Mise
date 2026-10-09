import type { DateString, Horizon, Task } from '../types';
import { addDays, localDay, weekEnd, weekStart } from './dates';

/** How far ahead the radar looks: Coming up, and Already handled on the home screen. */
export const WINDOW_DAYS = 42;

/** A potential gap the radar raised, not yet answered. */
export function isOpenCheck(task: Task): boolean {
  return task.kind === 'check' && !task.done_at;
}

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
  if (date <= addDays(now, WINDOW_DAYS)) return 'month';
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
  // A moved task takes its place by date in its new section, not its old manual position.
  const dated = effectiveDate(task) !== null;
  if (!dated) return { horizon: to, order: null };
  const nextMonday = addDays(weekStart(now), 7);
  switch (to) {
    case 'now':
      return { horizon: to, do_by: now, order: null };
    case 'month':
      return { horizon: to, do_by: nextMonday, order: null };
    case 'later':
      return { horizon: to, do_by: addDays(now, WINDOW_DAYS + 7), order: null };
  }
}

/** The last day a done task covers: the end of its range, or its date. */
export function lastDay(task: Task): DateString | null {
  return task.when_end ?? task.when;
}

/** Done, with its date (or the end of its range) still ahead: Already handled. */
export function isHandledAhead(task: Task, now: DateString): boolean {
  const last = lastDay(task);
  return task.done_at !== null && last !== null && last >= now;
}

/** Already handled, on the home screen: starting within the radar's six weeks. */
export function isHandledSoon(task: Task, now: DateString): boolean {
  return isHandledAhead(task, now) && task.when! <= addDays(now, WINDOW_DAYS);
}

/** Whether a task's dates touch the days from..to: what the radar asks to see if something is covered. */
export function overlaps(task: Task, from: DateString, to: DateString): boolean {
  const ranges: [DateString, DateString][] = [];
  if (task.when) ranges.push([task.when, lastDay(task)!]);
  if (!task.done_at) {
    for (const d of [task.do_by, task.deadline, ...task.steps.filter((s) => !s.done_at).map((s) => s.do_by)]) {
      if (d) ranges.push([d, d]);
    }
  }
  return ranges.some(([a, b]) => a <= to && b >= from);
}

export function isDoneThisWeek(task: Task, now: DateString): boolean {
  return task.done_at !== null && localDay(task.done_at) >= weekStart(now);
}
