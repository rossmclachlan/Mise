import type { DateString, Task } from '../types';
import { addDays, localDay } from './dates';
import { lastDay } from './horizon';

// Each time an app reconnects after half an hour away, Firestore re-reads (and
// bills) everything it listens to. So the apps and the connector load open
// tasks and recently finished ones, not every task ever done: finished tasks
// carry done_recent, which the Worker clears once they're old.

/** How long a finished task stays loaded (and in Done's history) before it needs "Show older". */
export const RECENT_DAYS = 56;

/** Whether a finished task still belongs in what's loaded: done in the last 8 weeks, or its date (a booking) still ahead. */
export function stillRecent(task: Task, today: DateString): boolean {
  if (!task.done_at) return false;
  const last = lastDay(task);
  return localDay(task.done_at) >= addDays(today, -RECENT_DAYS) || (last !== null && last >= today);
}
