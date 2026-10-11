import type { DateString, Task } from '../types';
import { addDaysToMoment } from './dates';
import { effectiveDate, effectiveHorizon, isOverdue } from './horizon';
import { compareOpen } from './ops';
import { daysBetween } from './repeat';
import { isOnMe } from './visibility';

// What notifications say and who gets them. The Worker sends them; the app
// only subscribes. Shared here so the logic is tested with the rest.

/** The morning digest goes out at this local hour unless someone picks another. */
export const DIGEST_HOUR = 7;

export const DIGEST_HOURS = [6, 7, 8, 9] as const;

export interface PushMessage {
  title: string;
  body: string;
  /** Where tapping it goes, relative to the app. */
  url: string;
  /** A newer notification with the same tag replaces the older one. */
  tag: string;
}

/**
 * One person's morning digest: their Needs action now, top 3 first, with what's
 * overdue counted. Null when nothing's on them this week.
 */
export function digestFor(tasks: Task[], uid: string, now: DateString): PushMessage | null {
  const mine = tasks
    .filter((t) => !t.done_at && isOnMe(t, uid) && effectiveHorizon(t, now) === 'now')
    .sort(compareOpen);
  if (mine.length === 0) return null;
  const overdue = mine.filter((t) => isOverdue(t, now)).length;
  const dueToday = mine.filter((t) => effectiveDate(t) === now).length;
  const counts = [
    `${mine.length} this week`,
    ...(dueToday ? [`${dueToday} today`] : []),
    ...(overdue ? [`${overdue} overdue`] : []),
  ];
  const top = mine.slice(0, 3).map((t) => `• ${t.kind === 'check' ? '⚠️ ' : ''}${t.title}`);
  if (mine.length > 3) top.push(`+${mine.length - 3} more`);
  return { title: `Priorities: ${counts.join(', ')}`, body: top.join('\n'), url: './', tag: 'digest' };
}

/** Who a task's reminder goes to: whoever's on it, else whoever set it up. */
export function reminderRecipients(task: Task, fallbackUid: string | null): string[] {
  if (task.list === 'personal') return task.owner_uid ? [task.owner_uid] : [];
  if (task.assignee.length) return task.assignee;
  return fallbackUid ? [fallbackUid] : [];
}

export function reminderFor(task: Task): PushMessage {
  const steps = task.steps.filter((s) => !s.done_at);
  return {
    title: task.title,
    body: steps.length ? `Next: ${steps[0].title}` : 'Reminder from Priorities',
    url: `./?task=${task.id}`,
    tag: `task-${task.id}`,
  };
}

/**
 * The reminder for a repeating task's next occurrence: the same time of day,
 * moved by as many days as its date moved. Null if that's already past.
 */
export function nextReminder(task: Task, fromDate: DateString | null, toDate: DateString, nowIso: string): string | null {
  const last = task.remind_at ?? task.reminded_at ?? null;
  if (!last || !fromDate) return null;
  const next = addDaysToMoment(last, daysBetween(fromDate, toDate));
  return next > nowIso ? next : null;
}
