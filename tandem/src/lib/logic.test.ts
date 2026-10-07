import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { addMonths, weekEnd, weekStart } from './dates';
import {
  effectiveDate,
  effectiveHorizon,
  isDoneThisWeek,
  isOverdue,
  isTakenCareOfSoon,
  moveToHorizon,
} from './horizon';
import { completeTask, skipOccurrence, buildTask } from './ops';
import { describeRepeat, nextOccurrence } from './repeat';
import { canSee, matchesFilter } from './visibility';

const ROSS = 'ross';
const EMILY = 'emily';
const NOW = '2026-10-07'; // a Wednesday
const actor = { uid: ROSS, via: 'app' as const };
const AT = '2026-10-07T15:00:00.000Z';

function task(overrides: Partial<Task> = {}): Task {
  return { ...buildTask({ title: 'Test', list: 'shared' }, actor, AT), ...overrides };
}

describe('dates', () => {
  it('runs weeks Monday to Sunday', () => {
    expect(weekStart(NOW)).toBe('2026-10-05');
    expect(weekEnd(NOW)).toBe('2026-10-11');
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sunday belongs to the week before
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
  });

  it('clamps month arithmetic to the last day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('effectiveHorizon', () => {
  it('keeps undated tasks where they were put', () => {
    expect(effectiveHorizon(task({ horizon: 'later' }), NOW)).toBe('later');
    expect(effectiveHorizon(task({ horizon: 'now' }), NOW)).toBe('now');
  });

  it('places dated tasks by date', () => {
    expect(effectiveHorizon(task({ do_by: '2026-10-11' }), NOW)).toBe('now'); // this Sunday
    expect(effectiveHorizon(task({ do_by: '2026-10-12' }), NOW)).toBe('month'); // next Monday
    expect(effectiveHorizon(task({ do_by: '2026-11-04' }), NOW)).toBe('month'); // 28 days out
    expect(effectiveHorizon(task({ do_by: '2026-11-05' }), NOW)).toBe('later');
    expect(effectiveHorizon(task({ do_by: '2026-09-30' }), NOW)).toBe('now'); // overdue
  });

  it('uses the deadline when there is no do-by date, and prefers do-by', () => {
    expect(effectiveHorizon(task({ deadline: '2026-10-09' }), NOW)).toBe('now');
    expect(effectiveHorizon(task({ do_by: '2026-11-20', deadline: '2026-10-09' }), NOW)).toBe('later');
  });

  it('pulls a big job forward to its earliest open step', () => {
    const t = task({
      do_by: '2026-12-15',
      steps: [
        { id: 'a', title: 'Photos', done_at: null, assignee: null, do_by: '2026-10-09' },
        { id: 'b', title: 'Forms', done_at: null, assignee: null, do_by: '2026-11-15' },
      ],
    });
    expect(effectiveDate(t)).toBe('2026-10-09');
    expect(effectiveHorizon(t, NOW)).toBe('now');
    t.steps[0].done_at = AT;
    expect(effectiveHorizon(t, NOW)).toBe('later');
  });

  it('flags overdue open tasks only', () => {
    expect(isOverdue(task({ do_by: '2026-10-06' }), NOW)).toBe(true);
    expect(isOverdue(task({ do_by: '2026-10-07' }), NOW)).toBe(false);
    expect(isOverdue(task({ do_by: '2026-10-06', done_at: AT }), NOW)).toBe(false);
  });

  it('moves dated tasks by moving their do-by date', () => {
    const t = task({ do_by: '2026-10-08' });
    const later = { ...t, ...moveToHorizon(t, 'month', NOW) };
    expect(later.do_by).toBe('2026-10-12');
    expect(effectiveHorizon(later, NOW)).toBe('month');
    const undated = task({ horizon: 'now' });
    expect(moveToHorizon(undated, 'later', NOW)).toEqual({ horizon: 'later' });
  });
});

describe('taken care of', () => {
  it('shows done tasks whose date is ahead, within four weeks', () => {
    expect(isTakenCareOfSoon(task({ done_at: AT, when: '2026-10-20' }), NOW)).toBe(true);
    expect(isTakenCareOfSoon(task({ done_at: AT, when: '2026-10-07' }), NOW)).toBe(true);
    expect(isTakenCareOfSoon(task({ done_at: AT, when: '2026-10-06' }), NOW)).toBe(false);
    expect(isTakenCareOfSoon(task({ done_at: AT, when: '2026-12-01' }), NOW)).toBe(false);
    expect(isTakenCareOfSoon(task({ done_at: AT, when: null }), NOW)).toBe(false);
    expect(isTakenCareOfSoon(task({ when: '2026-10-20' }), NOW)).toBe(false);
  });

  it('counts done this week from Monday', () => {
    expect(isDoneThisWeek(task({ done_at: '2026-10-05T08:00:00Z' }), NOW)).toBe(true);
    expect(isDoneThisWeek(task({ done_at: '2026-10-04T08:00:00Z' }), NOW)).toBe(false);
  });
});

describe('repeats', () => {
  it('keeps a fixed schedule on the calendar', () => {
    const weekly = { every: 1, unit: 'week', mode: 'schedule' } as const;
    expect(nextOccurrence(weekly, '2026-10-08', '2026-10-08')).toBe('2026-10-15');
    // Done late: still lands on the next Thursday, not a week after doing it.
    expect(nextOccurrence(weekly, '2026-10-08', '2026-10-10')).toBe('2026-10-15');
    // Missed several weeks: skips past dates.
    expect(nextOccurrence(weekly, '2026-09-10', '2026-10-10')).toBe('2026-10-15');
  });

  it('counts after-done repeats from completion', () => {
    const quarterly = { every: 3, unit: 'month', mode: 'after_done' } as const;
    expect(nextOccurrence(quarterly, '2026-10-01', '2026-10-20')).toBe('2027-01-20');
  });

  it('describes repeats', () => {
    expect(describeRepeat({ every: 1, unit: 'week', mode: 'schedule' }, '2026-10-08')).toBe('every Thu');
    expect(describeRepeat({ every: 3, unit: 'month', mode: 'after_done' })).toBe('every 3 months after done');
    expect(describeRepeat({ every: 1, unit: 'year', mode: 'schedule' })).toBe('every year');
  });

  it('creates the next occurrence on completion, keeping the deadline gap', () => {
    const t = task({
      do_by: '2026-10-08',
      deadline: '2026-10-10',
      repeat: { every: 1, unit: 'week', mode: 'schedule' },
      steps: [{ id: 's', title: 'Bins out', done_at: AT, assignee: null, do_by: null }],
      notes: [{ id: 'n', text: 'hi', uid: ROSS, via: 'app', at: AT }],
    });
    const { update, next } = completeTask(t, actor, '2026-10-08T20:00:00.000Z', {
      outcome_note: 'done',
    });
    expect(update.done_at).toBe('2026-10-08T20:00:00.000Z');
    expect(update.outcome_note).toBe('done');
    expect(update.series_id).toBe(t.id);
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(t.id);
    expect(next!.do_by).toBe('2026-10-15');
    expect(next!.deadline).toBe('2026-10-17');
    expect(next!.series_id).toBe(t.id);
    expect(next!.done_at).toBeNull();
    expect(next!.steps[0].done_at).toBeNull();
    expect(next!.notes).toEqual([]);
  });

  it('does not create a next occurrence for one-off tasks', () => {
    expect(completeTask(task(), actor, AT).next).toBeNull();
  });

  it('skips to the next date without marking done', () => {
    const t = task({ do_by: '2026-10-08', repeat: { every: 1, unit: 'week', mode: 'after_done' } });
    const u = skipOccurrence(t, actor, AT);
    expect(u.do_by).toBe('2026-10-15');
    expect(u.done_at).toBeUndefined();
  });
});

describe('visibility', () => {
  const mine = task({ list: 'personal', owner_uid: ROSS, assignee: [] });
  const hers = task({ list: 'personal', owner_uid: EMILY, assignee: [] });
  const sharedRoss = task({ assignee: [ROSS] });
  const sharedBoth = task({ assignee: [ROSS, EMILY] });
  const sharedEmily = task({ assignee: [EMILY] });
  const unclaimed = task({ assignee: [] });

  it('never shows another person\'s personal list', () => {
    expect(canSee(hers, ROSS)).toBe(false);
    for (const f of ['mine', 'shared', 'everything'] as const) {
      expect(matchesFilter(hers, f, ROSS)).toBe(false);
    }
  });

  it('filters Mine, Shared and Everything', () => {
    const all = [mine, hers, sharedRoss, sharedBoth, sharedEmily, unclaimed];
    const pick = (f: 'mine' | 'shared' | 'everything') => all.filter((t) => matchesFilter(t, f, ROSS));
    expect(pick('mine')).toEqual([mine, sharedRoss, sharedBoth]);
    expect(pick('shared')).toEqual([sharedRoss, sharedBoth, sharedEmily, unclaimed]);
    expect(pick('everything')).toEqual([mine, sharedRoss, sharedBoth, sharedEmily, unclaimed]);
  });
});
