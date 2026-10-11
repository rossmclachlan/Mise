import type { DateString, Horizon, Task } from '../types';
import { addDays, localDay, parseDate, weekEnd, weekStart } from './dates';

/** How far ahead the radar looks: Coming up, and Already handled on the home screen. */
export const WINDOW_DAYS = 42;

/** A potential gap the radar raised (shown with a ⚠️), not yet confirmed. */
export function isOpenCheck(task: Task): boolean {
  return task.kind === 'check' && !task.done_at;
}

/** The date that places an open task: its start-by date, or its due date when there's none. */
export function effectiveDate(task: Pick<Task, 'do_by' | 'deadline'>): DateString | null {
  return task.do_by ?? task.deadline ?? null;
}

export function horizonForDate(date: DateString, now: DateString): Horizon {
  if (date <= weekEnd(now)) return 'now';
  if (date <= addDays(now, WINDOW_DAYS)) return 'month';
  return 'later';
}

/** Where an open task shows. Its dates decide; a task with no date sits in Needs action now. */
export function effectiveHorizon(task: Pick<Task, 'do_by' | 'deadline'>, now: DateString): Horizon {
  const date = effectiveDate(task);
  return date ? horizonForDate(date, now) : 'now';
}

export function isOverdue(task: Task, now: DateString): boolean {
  const date = effectiveDate(task);
  return !task.done_at && date !== null && date < now;
}

/** Next Monday: where "Not this week" puts a task. */
export function nextMonday(now: DateString): DateString {
  return addDays(weekStart(now), 7);
}

/**
 * Pushes a task back by moving its start-by date (its due date stays): to next
 * week ('month'), past the radar's six weeks ('later'), or to a given day.
 */
export function deferTo(to: 'month' | 'later' | DateString, now: DateString): Partial<Task> {
  const date = to === 'month' ? nextMonday(now) : to === 'later' ? addDays(now, WINDOW_DAYS + 7) : to;
  return { do_by: date, order: null };
}

/**
 * A new due date, with the start-by date kept in step: it keeps its lead time
 * when the task had both dates, and never sits after the new due date.
 */
export function withDue(task: Pick<Task, 'do_by' | 'deadline'>, due: DateString | null): Partial<Task> {
  const changes: Partial<Task> = { deadline: due, order: null };
  if (!due || !task.do_by) return changes;
  if (task.deadline) {
    const lead = Math.round((parseDate(task.deadline).getTime() - parseDate(task.do_by).getTime()) / 86_400_000);
    changes.do_by = addDays(due, -lead);
  } else if (task.do_by > due) {
    changes.do_by = due;
  }
  return changes;
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
    for (const d of [task.do_by, task.deadline]) {
      if (d) ranges.push([d, d]);
    }
  }
  return ranges.some(([a, b]) => a <= to && b >= from);
}

export function isDoneThisWeek(task: Task, now: DateString): boolean {
  return task.done_at !== null && localDay(task.done_at) >= weekStart(now);
}
