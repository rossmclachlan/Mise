import type { DateString, HistoryEntry, IsoString, Task, Via } from '../types';
import { addDays, localDay } from './dates';
import { effectiveDate } from './horizon';
import { daysBetween, nextOccurrence } from './repeat';

// Pure functions that turn an action into the writes it needs. The app and
// (later) the MCP Worker share them, so both behave the same.

export interface Actor {
  uid: string;
  via: Via;
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

export function historyEntry(actor: Actor, what: string, at: IsoString): HistoryEntry {
  return { at, uid: actor.uid, via: actor.via, what };
}

export interface NewTaskInput {
  title: string;
  list: Task['list'];
  owner_uid?: string | null;
  assignee?: string[];
  horizon?: Task['horizon'];
  do_by?: DateString | null;
  deadline?: DateString | null;
  repeat?: Task['repeat'];
  source_url?: string | null;
  kind?: Task['kind'];
  /** Checks: the date in question. */
  when?: DateString | null;
  when_end?: DateString | null;
  radar_key?: string | null;
}

export function buildTask(input: NewTaskInput, actor: Actor, at: IsoString): Task {
  const personal = input.list === 'personal';
  return {
    id: newId(),
    title: input.title.trim(),
    list: input.list,
    owner_uid: personal ? (input.owner_uid ?? actor.uid) : null,
    assignee: personal ? [] : (input.assignee ?? [actor.uid]),
    horizon: input.horizon ?? 'now',
    do_by: input.do_by ?? null,
    deadline: input.deadline ?? null,
    kind: input.kind ?? 'task',
    order: null,
    done_at: null,
    done_by: null,
    outcome_note: null,
    when: input.when ?? null,
    when_end: input.when_end ?? null,
    radar_key: input.radar_key ?? null,
    steps: [],
    repeat: input.repeat ?? null,
    series_id: null,
    source_url: input.source_url ?? null,
    notes: [],
    created_at: at,
    created_by: { uid: actor.uid, via: actor.via },
    history: [historyEntry(actor, 'added', at)],
  };
}

export interface CompleteDetails {
  outcome_note?: string | null;
  when?: DateString | null;
  when_end?: DateString | null;
}

export interface CompleteResult {
  update: Partial<Task>;
  /** The next occurrence, for a repeating task. */
  next: Task | null;
}

export function completeTask(
  task: Task,
  actor: Actor,
  at: IsoString,
  details: CompleteDetails = {},
): CompleteResult {
  const doneOn = localDay(at);
  const update: Partial<Task> = {
    done_at: at,
    done_by: actor.uid,
    outcome_note: details.outcome_note ?? task.outcome_note,
    when: details.when ?? task.when,
    when_end: details.when_end !== undefined ? details.when_end : (task.when_end ?? null),
    history: [...task.history, historyEntry(actor, 'done', at)],
  };

  let next: Task | null = null;
  if (task.repeat) {
    const due = task.do_by ?? task.deadline;
    const nextDue = nextOccurrence(task.repeat, due, doneOn);
    const seriesId = task.series_id ?? task.id;
    update.series_id = seriesId;
    next = {
      ...task,
      id: newId(),
      do_by: nextDue,
      deadline:
        task.deadline && due ? addDays(nextDue, daysBetween(due, task.deadline)) : null,
      done_at: null,
      done_by: null,
      outcome_note: null,
      when: null,
      when_end: null,
      order: null,
      radar_key: null,
      steps: task.steps.map((s) => ({ ...s, done_at: null, do_by: null })),
      series_id: seriesId,
      notes: [],
      created_at: at,
      created_by: { uid: actor.uid, via: actor.via },
      history: [historyEntry(actor, 'repeat created', at)],
    };
  }
  return { update, next };
}

export function reopenTask(task: Task, actor: Actor, at: IsoString): Partial<Task> {
  return {
    done_at: null,
    done_by: null,
    history: [...task.history, historyEntry(actor, 'reopened', at)],
  };
}

/** Moves a repeating task to its next date without marking it done. */
export function skipOccurrence(task: Task, actor: Actor, at: IsoString): Partial<Task> {
  if (!task.repeat) return {};
  const due = task.do_by ?? task.deadline ?? localDay(at);
  const nextDue = nextOccurrence({ ...task.repeat, mode: 'schedule' }, due, localDay(at));
  return {
    do_by: nextDue,
    deadline: task.deadline ? addDays(nextDue, daysBetween(due, task.deadline)) : null,
    history: [...task.history, historyEntry(actor, 'skipped this time', at)],
  };
}

/** Steps progress, e.g. { done: 1, total: 3, next: 'Get photos' }. */
export function stepProgress(task: Task) {
  const done = task.steps.filter((s) => s.done_at).length;
  const next = task.steps.find((s) => !s.done_at) ?? null;
  return { done, total: task.steps.length, next };
}

/**
 * Where an open task sits in its section, lower first: its manual position if
 * someone dragged it, otherwise its date (undated tasks by when they were added).
 * Both are milliseconds, so a dragged task lands among dated ones sensibly.
 */
export function orderKey(task: Task): number {
  if (typeof task.order === 'number') return task.order;
  const date = effectiveDate(task);
  return date ? Date.parse(`${date}T12:00:00Z`) : Date.parse(task.created_at);
}

export function compareOpen(a: Task, b: Task): number {
  return orderKey(a) - orderKey(b) || (a.created_at < b.created_at ? -1 : 1);
}

/** The order for a task dropped between two others (either may be missing at the ends). */
export function orderBetween(before: Task | undefined, after: Task | undefined): number {
  const HOUR = 3_600_000;
  if (before && after) return (orderKey(before) + orderKey(after)) / 2;
  if (before) return orderKey(before) + HOUR;
  if (after) return orderKey(after) - HOUR;
  return 0;
}
