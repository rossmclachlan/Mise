import type { DateString } from '../types';

// All date math works on local calendar dates ('YYYY-MM-DD'), never on
// timestamps, so a task due "Thursday" is Thursday wherever we are.

export function toDateString(d: Date): DateString {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s: DateString): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// The calendar we count days in. Browsers use the device's own time zone;
// the MCP Worker runs in UTC, so it sets ours explicitly.
let zone: string | undefined;

export function setTimeZone(tz: string | undefined): void {
  zone = tz;
}

/** The local calendar date of a moment, e.g. a done_at timestamp. */
export function localDay(moment: Date | string): DateString {
  const d = typeof moment === 'string' ? new Date(moment) : moment;
  if (!zone) return toDateString(d);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function today(): DateString {
  return localDay(new Date());
}

export function addDays(s: DateString, n: number): DateString {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

/** Adds months, clamping to the month's last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(s: DateString, n: number): DateString {
  const d = parseDate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toDateString(d);
}

/** Monday of the week containing s (weeks run Monday to Sunday). */
export function weekStart(s: DateString): DateString {
  const dow = parseDate(s).getDay(); // 0 = Sunday
  return addDays(s, -((dow + 6) % 7));
}

/** Sunday of the week containing s. */
export function weekEnd(s: DateString): DateString {
  return addDays(weekStart(s), 6);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Thu, Oct 8" */
export function formatDate(s: DateString): string {
  const d = parseDate(s);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Oct 8" */
export function formatShort(s: DateString): string {
  const d = parseDate(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Friendly relative label for a date near `now`: Today, Tomorrow, Thu, or Thu, Oct 8. */
export function relativeDate(s: DateString, now: DateString): string {
  if (s === now) return 'Today';
  if (s === addDays(now, 1)) return 'Tomorrow';
  if (s > now && s <= weekEnd(now)) return WEEKDAYS[parseDate(s).getDay()];
  return formatDate(s);
}

export function formatMonthYear(s: DateString): string {
  const d = parseDate(s);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
