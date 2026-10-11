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

// Words that don't tell two tasks apart.
const FILLER = new Set(['a', 'an', 'the', 'for', 'to', 'of', 'and', 'on', 'in', 'at', 'our', 'my', 'with']);

/** A title's telling words: lowercase, no punctuation, no leading verb, no filler, no plural s. */
function titleWords(title: string): Set<string> {
  const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  return new Set(
    words
      .slice(1)
      .filter((w) => !FILLER.has(w))
      .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)),
  );
}

/**
 * Whether two titles probably mean the same task ("Buy rainbow fish play tix"
 * and "Buy Rainbow Fish tickets"): most of the shorter one's words are in the other.
 */
export function similarTitles(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;
  const wa = titleWords(a);
  const wb = titleWords(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared > 0 && shared / Math.min(wa.size, wb.size) >= 0.6;
}
