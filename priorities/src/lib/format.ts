import type { Horizon, Task } from '../types';
import { formatDate, formatShort } from './dates';

export function initial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

/** "Wed, Nov 25", or "Nov 25 – Nov 27" for a range. */
export function formatWhen(when: string, end?: string | null): string {
  return end && end !== when ? `${formatShort(when)} – ${formatShort(end)}` : formatDate(when);
}

/** First line of a done task's outcome, or its date, for one-line summaries. */
export function outcomeLine(task: Task): string {
  const parts: string[] = [];
  if (task.when) parts.push(formatWhen(task.when, task.when_end));
  if (task.outcome_note) parts.push(task.outcome_note.split('\n')[0]);
  return parts.join(' · ');
}

// Emily's radar categories, used by the app, Claude and the weekly briefing alike.
export const HORIZON_NAMES: Record<Horizon, string> = {
  now: 'Needs action now',
  month: 'Coming up',
  later: 'Not yet',
};

/** For chips and buttons, where the full name doesn't fit. */
export const HORIZON_SHORT: Record<Horizon, string> = { now: 'Now', month: 'Coming up', later: 'Not yet' };

export const HORIZON_EMOJI: Record<Horizon, string> = { now: '🔴', month: '🟡', later: '⚪' };
export const HANDLED_NAME = 'Already handled';
export const HANDLED_EMOJI = '🟢';
export const GAPS_NAME = 'Potential gaps';
export const GAPS_EMOJI = '⚠️';
