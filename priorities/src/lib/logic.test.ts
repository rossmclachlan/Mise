import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { addDaysToMoment, addMonths, localTime, setTimeZone, weekEnd, weekStart, zonedMoment } from './dates';
import { digestFor, reminderRecipients } from './notify';
import {
  effectiveDate,
  effectiveHorizon,
  isDoneThisWeek,
  isOverdue,
  isHandledAhead,
  isHandledSoon,
  isOpenCheck,
  deferTo,
  overlaps,
  withDue,
} from './horizon';
import { completeTask, compareOpen, orderBetween, skipOccurrence, buildTask } from './ops';
import { classify, factsBetween, factsFromIcs } from './calendar';
import { describeRepeat, nextOccurrence } from './repeat';
import { canSee, matchesFilter } from './visibility';
import { migrateTask, normalizeTask } from './migrate';
import { matchesSearch, similarTitles } from './search';

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
  it('puts undated tasks in Needs action now', () => {
    expect(effectiveHorizon(task(), NOW)).toBe('now');
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

  it('ignores step dates', () => {
    const t = task({ do_by: '2026-12-15', steps: [{ id: 'a', title: 'Photos', done_at: null }] });
    expect(effectiveDate(t)).toBe('2026-12-15');
  });

  it('flags overdue open tasks only', () => {
    expect(isOverdue(task({ do_by: '2026-10-06' }), NOW)).toBe(true);
    expect(isOverdue(task({ do_by: '2026-10-07' }), NOW)).toBe(false);
    expect(isOverdue(task({ do_by: '2026-10-06', done_at: AT }), NOW)).toBe(false);
  });

  it('defers by moving the start-by date and keeps the due date', () => {
    const t = task({ deadline: '2026-10-09' });
    const later = { ...t, ...deferTo('month', NOW) };
    expect(later.do_by).toBe('2026-10-12');
    expect(later.deadline).toBe('2026-10-09');
    expect(effectiveHorizon(later, NOW)).toBe('month');
    expect(deferTo('later', NOW).do_by).toBe('2026-11-25');
    expect(deferTo('2026-12-01', NOW)).toEqual({ do_by: '2026-12-01', order: null });
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
      steps: [{ id: 's', title: 'Bins out', done_at: AT }],
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
  const mine = task({ list: 'personal', owner_uid: ROSS, assignee: [ROSS] });
  const hers = task({ list: 'personal', owner_uid: EMILY, assignee: [EMILY] });
  const sharedRoss = task({ assignee: [ROSS] });
  const sharedBoth = task({ assignee: [ROSS, EMILY] });
  const sharedEmily = task({ assignee: [EMILY] });

  it('never shows another person\'s personal list', () => {
    expect(canSee(hers, ROSS)).toBe(false);
    for (const f of [[ROSS], [ROSS, EMILY], [EMILY], []]) {
      expect(matchesFilter(hers, f, ROSS)).toBe(false);
    }
  });

  it('shows the tasks on whoever is picked, and nothing when nobody is', () => {
    const all = [mine, hers, sharedRoss, sharedBoth, sharedEmily];
    const pick = (f: string[]) => all.filter((t) => matchesFilter(t, f, ROSS));
    expect(pick([ROSS])).toEqual([mine, sharedRoss, sharedBoth]);
    expect(pick([EMILY])).toEqual([sharedBoth, sharedEmily]);
    expect(pick([ROSS, EMILY])).toEqual([mine, sharedRoss, sharedBoth, sharedEmily]);
    expect(pick([])).toEqual([]);
  });
});

describe('who it is on', () => {
  it('puts a new task on whoever adds it, and a personal one on its owner', () => {
    expect(buildTask({ title: 'A', list: 'shared' }, actor, AT).assignee).toEqual([ROSS]);
    expect(buildTask({ title: 'A', list: 'shared', assignee: [] }, actor, AT).assignee).toEqual([ROSS]);
    expect(buildTask({ title: 'A', list: 'shared', assignee: [EMILY] }, actor, AT).assignee).toEqual([EMILY]);
    expect(buildTask({ title: 'A', list: 'personal', assignee: [EMILY] }, actor, AT).assignee).toEqual([ROSS]);
  });

  it('never reads a task as unclaimed', () => {
    const old = task({ assignee: [], created_by: { uid: EMILY, via: 'mcp' } });
    expect(normalizeTask(old).assignee).toEqual([EMILY]);
    expect(normalizeTask(task({ list: 'personal', owner_uid: ROSS, assignee: [] })).assignee).toEqual([ROSS]);
  });
});

describe('migration', () => {
  const stored = (o: Record<string, unknown>) => ({ ...task(), ...o }) as Parameters<typeof migrateTask>[0];

  it('assigns unclaimed tasks to whoever added them', () => {
    expect(migrateTask(stored({ assignee: [], created_by: { uid: EMILY, via: 'mcp' } }), NOW)).toEqual({ assignee: [EMILY] });
  });

  it('dates undated tasks parked in Coming up or Not yet, so they stay put', () => {
    expect(migrateTask(stored({ horizon: 'month' }), NOW)).toEqual({ do_by: '2026-10-12' });
    expect(migrateTask(stored({ horizon: 'later' }), NOW)).toEqual({ do_by: '2026-11-25' });
    expect(migrateTask(stored({ horizon: 'later', deadline: '2026-12-15' }), NOW)).toBeNull();
    expect(migrateTask(stored({ horizon: 'now' }), NOW)).toBeNull();
  });

  it('makes an open gap due on its date, starting six weeks before (or now)', () => {
    const gap = { kind: 'check', when: '2026-12-25', when_end: '2026-12-31' };
    expect(migrateTask(stored(gap), NOW)).toEqual({ deadline: '2026-12-25', do_by: '2026-11-13' });
    expect(migrateTask(stored({ ...gap, when: '2026-10-20' }), NOW)).toEqual({ deadline: '2026-10-20', do_by: NOW });
    expect(migrateTask(stored({ ...gap, done_at: AT }), NOW)).toBeNull();
  });

  it('turns steps into a plain checklist', () => {
    const steps = [{ id: 'a', title: 'Photos', done_at: null, assignee: ROSS, do_by: '2026-10-09' }];
    expect(migrateTask(stored({ steps }), NOW)).toEqual({ steps: [{ id: 'a', title: 'Photos', done_at: null }] });
    expect(migrateTask(stored({ steps: [{ id: 'a', title: 'Photos', done_at: null }] }), NOW)).toBeNull();
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

  it('marks gaps until they are confirmed', () => {
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

describe('notifications', () => {
  it('converts local times in our zone, across daylight saving', () => {
    setTimeZone('America/Los_Angeles');
    try {
      expect(zonedMoment('2026-10-07', '09:00')).toBe('2026-10-07T16:00:00.000Z');
      expect(zonedMoment('2026-11-02', '09:00')).toBe('2026-11-02T17:00:00.000Z');
      // Same time of day after the clocks change.
      expect(addDaysToMoment('2026-10-30T16:00:00.000Z', 7)).toBe('2026-11-06T17:00:00.000Z');
      expect(localTime('2026-10-07T14:05:00.000Z')).toEqual({ date: '2026-10-07', hour: 7, minute: 5 });
    } finally {
      setTimeZone(undefined);
    }
  });

  it('builds a digest of what is on someone this week, top 3 first', () => {
    const tasks = [
      task({ title: 'Overdue', assignee: [ROSS], do_by: '2026-10-05' }),
      task({ title: 'Today', assignee: [ROSS, EMILY], do_by: NOW }),
      task({ title: 'Undated', assignee: [ROSS] }),
      task({ title: 'Friday', assignee: [ROSS], do_by: '2026-10-09' }),
      task({ title: 'Next month', assignee: [ROSS], do_by: '2026-11-20' }),
      task({ title: 'Emily only', assignee: [EMILY], do_by: NOW }),
      task({ title: 'Done', assignee: [ROSS], do_by: NOW, done_at: AT }),
    ];
    const d = digestFor(tasks, ROSS, NOW)!;
    expect(d.title).toBe('Priorities: 4 this week, 1 today, 1 overdue');
    expect(d.body).toBe('• Overdue\n• Today\n• Undated\n+1 more'); // the app's order: undated by when added
    expect(digestFor(tasks.slice(4), ROSS, NOW)).toBeNull();
  });

  it('reminds whoever is on a task, and only its owner for a private one', () => {
    expect(reminderRecipients(task({ assignee: [EMILY] }), ROSS)).toEqual([EMILY]);
    expect(reminderRecipients(task({ assignee: [] }), ROSS)).toEqual([ROSS]);
    expect(reminderRecipients(task({ list: 'personal', owner_uid: EMILY, assignee: [] }), ROSS)).toEqual([EMILY]);
  });

  it("moves a repeating task's reminder with it", () => {
    const t = task({ do_by: NOW, repeat: { every: 1, unit: 'week', mode: 'schedule' }, reminded_at: '2026-10-07T16:00:00.000Z' });
    const { update, next } = completeTask(t, actor, AT);
    expect(next!.remind_at).toBe(addDaysToMoment('2026-10-07T16:00:00.000Z', 7));
    expect(update.remind_at).toBeUndefined();
    const pending = task({ do_by: NOW, remind_at: '2026-10-08T16:00:00.000Z' });
    expect(completeTask(pending, actor, AT).update.remind_at).toBeNull();
  });
});

describe('matchesSearch', () => {
  it('matches every word across title, notes, steps and outcome, any case', () => {
    const t = task({
      title: 'Buy Rainbow Fish tickets',
      notes: [{ id: 'n', text: 'Saturday matinee', uid: ROSS, via: 'app', at: AT }],
      steps: [{ id: 's', title: 'Check the seating plan', done_at: null }],
      outcome_note: 'Confirmation ABC123',
    });
    expect(matchesSearch(t, 'rainbow fish')).toBe(true);
    expect(matchesSearch(t, 'matinee')).toBe(true);
    expect(matchesSearch(t, 'seating')).toBe(true);
    expect(matchesSearch(t, 'abc123')).toBe(true);
    expect(matchesSearch(t, 'rainbow passport')).toBe(false);
    expect(matchesSearch(t, '   ')).toBe(false);
  });
});

describe('similarTitles', () => {
  it('catches the same task worded differently', () => {
    expect(similarTitles('Buy rainbow fish play tix', 'Buy Rainbow Fish tickets')).toBe(true);
    expect(similarTitles('Book dentist', 'book dentist')).toBe(true);
    expect(similarTitles('Renew passports', 'Renew passport')).toBe(true);
  });
  it('leaves different things alone', () => {
    expect(similarTitles('Pay water bill', 'Pay electricity bill')).toBe(false);
    expect(similarTitles('Renew car insurance', 'Renew car registration')).toBe(false);
    expect(similarTitles('Book camp for Nov 11', 'Buy Halloween costumes')).toBe(false);
  });
});

describe('withDue', () => {
  it('keeps the start date its lead time before the new due date', () => {
    expect(withDue({ do_by: '2026-10-20', deadline: '2026-11-03' }, '2026-12-01')).toEqual({
      deadline: '2026-12-01',
      do_by: '2026-11-17',
      order: null,
    });
  });
  it('pulls a start-only date back to the due date, and leaves an earlier one', () => {
    expect(withDue({ do_by: '2026-12-01', deadline: null }, '2026-11-01').do_by).toBe('2026-11-01');
    expect(withDue({ do_by: '2026-10-20', deadline: null }, '2026-11-01').do_by).toBeUndefined();
  });
  it('clearing the due date leaves the start date', () => {
    expect(withDue({ do_by: '2026-10-20', deadline: '2026-11-03' }, null)).toEqual({ deadline: null, order: null });
  });
});
