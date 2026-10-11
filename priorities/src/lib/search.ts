import type { Task } from '../types';

/** Whether every word of a search appears in the task's title, notes, steps or outcome. */
export function matchesSearch(task: Task, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const hay = [task.title, task.outcome_note ?? '', ...task.notes.map((n) => n.text), ...task.steps.map((s) => s.title)]
    .join(' ')
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}
