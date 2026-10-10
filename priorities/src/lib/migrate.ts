import type { DateString, Step, Task } from '../types';
import { addDays } from './dates';
import { WINDOW_DAYS, nextMonday } from './horizon';

// Moving tasks written before the simpler model (Oct 2026): every task has a
// person, dates alone place a task, gaps are dated tasks, steps are a plain
// checklist. The MCP Worker runs migrateTask once over every task; the app and
// the Worker both read through normalizeTask, so an old task that slips past
// still shows sensibly.

/** A task as stored before the change: it may carry a manual horizon and step owners and dates. */
type StoredTask = Task & { horizon?: 'now' | 'month' | 'later' };

/** Who an unassigned task is on: its owner if personal, else whoever added it. */
function fallbackAssignee(task: Task): string[] {
  return task.list === 'personal' && task.owner_uid ? [task.owner_uid] : [task.created_by.uid];
}

/** Fills what older or partial documents may lack. Pure: no writes. */
export function normalizeTask(task: Task): Task {
  const t = {
    ...task,
    steps: task.steps ?? [],
    notes: task.notes ?? [],
    history: task.history ?? [],
    repeat: task.repeat ?? null,
    kind: task.kind ?? 'task',
    order: typeof task.order === 'number' ? task.order : null,
    when_end: task.when_end ?? null,
    radar_key: task.radar_key ?? null,
  };
  if (!t.assignee?.length) t.assignee = fallbackAssignee(t);
  return t;
}

function plainStep(s: Step): Step {
  return { id: s.id, title: s.title, done_at: s.done_at };
}

/** A potential gap is due on the day in question and starts six weeks before it (or now, if that's sooner). */
export function gapDates(when: DateString, now: DateString): { deadline: DateString; do_by: DateString } {
  const start = addDays(when, -WINDOW_DAYS);
  return { deadline: when, do_by: start > now ? start : now };
}

/** The writes that bring one stored task up to date, or null if it already is. */
export function migrateTask(task: StoredTask, now: DateString): Partial<Task> | null {
  const u: Partial<Task> = {};
  if (!task.assignee?.length) u.assignee = fallbackAssignee(task);

  const open = !task.done_at;
  if (open && task.kind === 'check' && task.when) {
    const dates = gapDates(task.when, now);
    if (!task.deadline) u.deadline = dates.deadline;
    if (!task.do_by) u.do_by = dates.do_by;
  } else if (open && !task.do_by && !task.deadline && (task.horizon === 'month' || task.horizon === 'later')) {
    // Undated tasks parked by hand keep their place by getting a date.
    u.do_by = task.horizon === 'month' ? nextMonday(now) : addDays(now, WINDOW_DAYS + 7);
  }

  const steps = task.steps ?? [];
  if (steps.some((s) => Object.keys(s).some((k) => k !== 'id' && k !== 'title' && k !== 'done_at'))) {
    u.steps = steps.map(plainStep);
  }
  return Object.keys(u).length ? u : null;
}
