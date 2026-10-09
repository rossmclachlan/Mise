import type { Horizon, Task } from '../types';
import { formatDate } from './dates';

export function initial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

/** First line of a done task's outcome, or its date, for one-line summaries. */
export function outcomeLine(task: Task): string {
  const parts: string[] = [];
  if (task.when) parts.push(formatDate(task.when));
  if (task.outcome_note) parts.push(task.outcome_note.split('\n')[0]);
  return parts.join(' · ');
}

export const HORIZON_NAMES: Record<Horizon, string> = {
  now: 'Now',
  month: 'This month',
  later: 'Later',
};
