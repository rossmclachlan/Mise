import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { addMonths, weekEnd, weekStart } from './dates';
import {
  effectiveDate,
  effectiveHorizon,
  isDoneThisWeek,
  isOverdue,
  isHandledAhead,
  isHandledSoon,
  isOpenCheck,
  moveToHorizon,
  overlaps,
} from './horizon';
import { completeTask, compareOpen, orderBetween, skipOccurrence, buildTask } from './ops';
import { classify, factsBetween, factsFromIcs } from './calendar';
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
    expect(effectiveHorizon(task({ do_by: '2026-11-18' }), NOW)).toBe('month'); // 42 days out
    expect(effectiveHorizon(task({ do_by: '2026-11-19' }), NOW)).toBe('later');
    expect(effectiveHorizon(task({ do_by: '2026-11-20' }), NOW)).toBe('later');
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
        { id: 'b', title: 'Forms', done_at: null, assignee: null, do_by: '2026-11-25' },
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
    expect(moveToHorizon(undated, 'later', NOW)).toEqual({ horizon: 'later', order: null });
  });
});

describe('taken care of', () => {
  it('shows done tasks whose date is ahead, within six weeks', () => {
    expect(isHandledSoon(task({ done_at: AT, when: '2026-10-20' }), NOW)).toBe(true);
    expect(isHandledSoon(task({ done_at: AT, when: '2026-10-07' }), NOW)).toBe(true);
    expect(isHandledSoon(task({ done_at: AT, when: '2026-10-06' }), NOW)).toBe(false);
    expect(isHandledSoon(task({ done_at: AT, when: '2026-11-18' }), NOW)).toBe(true);
    expect(isHandledSoon(task({ done_at: AT, when: '2026-12-01' }), NOW)).toBe(false);
    expect(isHandledSoon(task({ done_at: AT, when: null }), NOW)).toBe(false);
    expect(isHandledSoon(task({ when: '2026-10-20' }), NOW)).toBe(false);
  });

  it('keeps a range handled until its last day', () => {
    const camp = task({ done_at: AT, when: '2026-10-05', when_end: '2026-10-09' });
    expect(isHandledAhead(camp, NOW)).toBe(true);
    expect(isHandledAhead(camp, '2026-10-10')).toBe(false);
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

describe('local days', () => {
  it('dates a completion in our time zone, not UTC', async () => {
    const { localDay, setTimeZone } = await import('./dates');
    setTimeZone('America/Los_Angeles');
    // 7pm Pacific on Oct 8 is already Oct 9 in UTC.
    expect(localDay('2026-10-09T02:00:00.000Z')).toBe('2026-10-08');
    const weekly = task({ do_by: '2026-10-08', repeat: { every: 1, unit: 'week', mode: 'after_done' } });
    expect(completeTask(weekly, actor, '2026-10-09T02:00:00.000Z').next!.do_by).toBe('2026-10-15');
    setTimeZone(undefined);
  });
});

describe('radar', () => {
  it('finds what covers a range of days', () => {
    const camp = task({ done_at: AT, when: '2026-11-25', when_end: '2026-11-27' });
    expect(overlaps(camp, '2026-11-23', '2026-11-24')).toBe(false);
    expect(overlaps(camp, '2026-11-23', '2026-11-25')).toBe(true);
    expect(overlaps(task({ deadline: '2026-11-11' }), '2026-11-11', '2026-11-11')).toBe(true);
    // A done task's old do-by date isn't coverage.
    expect(overlaps(task({ done_at: AT, do_by: '2026-11-11' }), '2026-11-11', '2026-11-11')).toBe(false);
  });

  it('keeps checks out of the lists until answered', () => {
    const check = buildTask({ title: 'Childcare Oct 12?', list: 'shared', kind: 'check', when: '2026-10-12' }, actor, AT);
    expect(isOpenCheck(check)).toBe(true);
    expect(isOpenCheck({ ...check, done_at: AT })).toBe(false);
    expect(isOpenCheck(task())).toBe(false);
  });
});

describe('ordering', () => {
  it('sorts by date until someone drags, then keeps the dragged spot', () => {
    const a = task({ id: 'a', do_by: '2026-10-20' });
    const b = task({ id: 'b', do_by: '2026-10-25' });
    const c = task({ id: 'c', do_by: '2026-10-30' });
    expect([c, a, b].sort(compareOpen).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    const dragged = { ...c, order: orderBetween(a, b) };
    expect([dragged, a, b].sort(compareOpen).map((t) => t.id)).toEqual(['a', 'c', 'b']);
    const top = { ...b, order: orderBetween(undefined, a) };
    expect([a, top, c].sort(compareOpen).map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('school calendar', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20261012',
    'DTEND;VALUE=DATE:20261013',
    "SUMMARY:Indigenous Peoples' Day - No School",
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20261123',
    'DTEND;VALUE=DATE:20261128',
    'SUMMARY:Thanksgiving',
    '  Break',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART:20261015T020000Z',
    'DTEND:20261015T030000Z',
    'SUMMARY:PTA Meeting',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART:20261021T190000Z',
    'SUMMARY:Minimum Day',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20260901',
    'SUMMARY:Labor Day',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  it('keeps days off and short days, with ranges, and drops timed meetings and past dates', () => {
    expect(factsFromIcs(ics, 'Lincoln', NOW)).toEqual([
      { date: '2026-10-12', end: null, title: "Indigenous Peoples' Day - No School", kind: 'no_school', source: 'Lincoln' },
      { date: '2026-10-21', end: null, title: 'Minimum Day', kind: 'early_release', source: 'Lincoln' },
      { date: '2026-11-23', end: '2026-11-27', title: 'Thanksgiving Break', kind: 'no_school', source: 'Lincoln' },
    ]);
  });

  it('tells closures from events that mention them', () => {
    expect(classify('Veterans Day')).toBe('no_school');
    expect(classify('Teacher Workday')).toBe('no_school');
    expect(classify('Holiday Concert')).toBe('event');
    expect(classify('Early Release')).toBe('early_release');
    expect(classify('Picture Day')).toBe('event');
  });

  it('finds facts touching a window', () => {
    const facts = factsFromIcs(ics, 'Lincoln', NOW);
    expect(factsBetween(facts, '2026-11-25', '2026-11-30').map((f) => f.title)).toEqual(['Thanksgiving Break']);
  });
});
