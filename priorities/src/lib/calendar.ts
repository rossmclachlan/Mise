import type { CalendarFact, CalendarFactKind, DateString } from '../types';
import { addDays } from './dates';

// School calendars arrive as iCal (.ics) feeds. The Worker reads them daily and
// keeps the days that matter for planning (no school, minimum days, breaks)
// plus other all-day school events, so the radar can check them for coverage.

interface RawEvent {
  summary: string;
  start: string;
  startIsDate: boolean;
  end: string | null;
  endIsDate: boolean;
}

/** Joins folded lines (a continuation starts with a space or tab). */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescape(text: string): string {
  return text.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

/** "20261012" or "20261012T080000Z" (any time zone) → "2026-10-12". */
function toDay(value: string): DateString | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parseEvents(ics: string): RawEvent[] {
  const events: RawEvent[] = [];
  let cur: Partial<RawEvent> | null = null;
  for (const line of unfold(ics)) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur?.start && cur.summary) events.push({ end: null, endIsDate: false, ...cur } as RawEvent);
      cur = null;
    } else if (cur) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const [name, ...params] = line.slice(0, colon).split(';');
      const value = line.slice(colon + 1);
      const isDate = params.includes('VALUE=DATE') || /^\d{8}$/.test(value);
      if (name === 'SUMMARY') cur.summary = unescape(value);
      else if (name === 'DTSTART') Object.assign(cur, { start: value, startIsDate: isDate });
      else if (name === 'DTEND') Object.assign(cur, { end: value, endIsDate: isDate });
    }
  }
  return events;
}

const NO_SCHOOL =
  /\b(no school|no classes|school closed|schools closed|closed|holiday|break|recess|vacation|teacher ?(work ?day|planning|prep)|staff ?(development|day)|professional (development|learning)|in-?service|pupil[- ]free|non[- ]student|student[- ]free|records day|furlough)\b/i;
// School holidays often appear by name only ("Veterans Day").
const HOLIDAYS =
  /\b(labor day|veterans'? day|memorial day|presidents'? day|indigenous peoples'? day|columbus day|mlk|martin luther king|thanksgiving|juneteenth|independence day|c[eé]sar ch[aá]vez|lincoln'?s? (birth)?day|new year'?s?( day)?|good friday|lunar new year)\b/i;
const EARLY = /\b(minimum day|early (release|dismissal|out)|half[- ]day|short(ened)? day|late start)\b/i;

// "Holiday concert", "Winter break food drive": events that mention a break, not closures.
const EVENT_WORDS = /\b(concert|party|program|performance|show|sale|drive|assembly|spirit|fair|camp|club|meeting|night|lunch|potluck|feast|luncheon)\b/i;

export function classify(title: string): CalendarFactKind {
  if (EARLY.test(title)) return 'early_release';
  if (EVENT_WORDS.test(title)) return 'event';
  if (NO_SCHOOL.test(title) || HOLIDAYS.test(title)) return 'no_school';
  return 'event';
}

/**
 * The calendar facts in an iCal feed from `from` up to a year ahead. Keeps all-day
 * events, and timed ones only when they look like a closure or minimum day
 * (a feed's timed events are mostly meetings and games). Repeating events
 * count once, on their first date.
 */
export function factsFromIcs(ics: string, source: string, from: DateString): CalendarFact[] {
  const until = addDays(from, 400);
  const facts: CalendarFact[] = [];
  for (const e of parseEvents(ics)) {
    const date = toDay(e.start);
    if (!date) continue;
    const kind = classify(e.summary);
    if (!e.startIsDate && kind === 'event') continue;
    let end = e.end ? toDay(e.end) : null;
    // An all-day event's DTEND is the day after its last day.
    if (end && e.endIsDate) end = addDays(end, -1);
    if (!end || end <= date) end = null;
    if ((end ?? date) < from || date > until) continue;
    facts.push({ date, end, title: e.summary, kind, source });
  }
  return facts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, 300);
}

/** Facts touching the days from..to. */
export function factsBetween(facts: CalendarFact[], from: DateString, to: DateString): CalendarFact[] {
  return facts.filter((f) => f.date <= to && (f.end ?? f.date) >= from);
}

/** webcal:// is https:// to a fetcher. */
export function feedUrl(url: string): string {
  return url.trim().replace(/^webcals?:\/\//i, 'https://');
}
