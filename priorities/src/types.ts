import type { FeedbackRecord } from '../../src/components/ui/feedback';
// Dates without a time are stored as 'YYYY-MM-DD' strings; moments in time as
// full ISO strings. Firestore stores both as plain strings.
export type DateString = string;
export type IsoString = string;

export type ListKind = 'shared' | 'personal';
export type Horizon = 'now' | 'month' | 'later';
export type Via = 'app' | 'mcp';
export type TaskKind = 'task' | 'check';

/** A plain checklist item. (Older steps may still carry an assignee and date; both are ignored.) */
export interface Step {
  id: string;
  title: string;
  done_at: IsoString | null;
}

export interface Note {
  id: string;
  text: string;
  uid: string;
  via: Via;
  at: IsoString;
}

export interface HistoryEntry {
  at: IsoString;
  uid: string;
  via: Via;
  what: string;
}

export interface RepeatRule {
  every: number;
  unit: 'day' | 'week' | 'month' | 'year';
  /** 'schedule': next date follows the calendar; 'after_done': counted from completion. */
  mode: 'schedule' | 'after_done';
}

export interface Task {
  id: string;
  title: string;
  list: ListKind;
  /** Personal tasks only: whose list it is on. */
  owner_uid: string | null;
  /** Who it's on: always at least one person; both uids = both of us. A personal task is on its owner. */
  assignee: string[];
  /** "Start by": when to start, for things with lead time. Places the task when set. */
  do_by: DateString | null;
  /** "Due": the date it needs to be done by. */
  deadline: DateString | null;
  /** 'check': a potential gap the radar raised ("Confirm childcare for Oct 12"), shown with a ⚠️. Ticked when confirmed. */
  kind?: TaskKind;
  /**
   * Manual position within its section, lower first; null = by date. Set by
   * dragging (or Claude's reorder); cleared when the task's date changes.
   */
  order: number | null;
  done_at: IsoString | null;
  done_by: string | null;
  outcome_note: string | null;
  /**
   * The date a done task is about (the appointment, the due date a payment
   * covers). On a check, the date in question.
   */
  when: DateString | null;
  /** Last day, when `when` is a range (camp Nov 25 to 27). */
  when_end?: DateString | null;
  /** Set by the radar: a stable key ("childcare:2026-10-12") so neither of our radars adds the same thing twice. */
  radar_key?: string | null;
  steps: Step[];
  repeat: RepeatRule | null;
  /** When to send a reminder notification to whoever's on the task. Cleared once sent. */
  remind_at?: IsoString | null;
  /** The last reminder sent, so a repeating task's next occurrence can be reminded at the same time of day. */
  reminded_at?: IsoString | null;
  /** Links the occurrences of a repeating task. */
  series_id: string | null;
  source_url: string | null;
  notes: Note[];
  created_at: IsoString;
  created_by: { uid: string; via: Via };
  history: HistoryEntry[];
}

export interface HouseRules {
  text: string;
  updated_at: IsoString;
  updated_by: string;
}

/** A school (or other) calendar the Worker reads every day. */
export interface CalendarFeed {
  name: string;
  /** An iCal (.ics) link; webcal:// links work too. */
  url: string;
}

export type CalendarFactKind = 'no_school' | 'early_release' | 'event';

/** A day off school, a minimum day, a break: the dates the radar checks for coverage. */
export interface CalendarFact {
  date: DateString;
  /** Last day, for a range such as a break. */
  end: DateString | null;
  title: string;
  kind: CalendarFactKind;
  /** The feed's name, or 'manual' for dates Claude added from a pasted calendar. */
  source: string;
}

export interface RadarRun {
  uid: string;
  at: IsoString;
  /** Whether this run did the shared sweep (school, childcare, the shared list) or only its person's own. */
  shared: boolean;
  summary: string;
}

/** One phone or browser that gets notifications. The id is derived from the endpoint. */
export interface PushSubscriptionRecord {
  uid: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: IsoString;
  /** "Android", "iPhone": shown in settings. */
  device: string;
}

export interface NotifyPrefs {
  /** Local hour (0-23) for the morning digest; null = no digest. Absent = the default (DIGEST_HOUR). */
  digest_hour?: number | null;
}

export interface Household {
  id: string;
  name: string;
  members: string[];
  member_names: Record<string, string>;
  house_rules?: HouseRules;
  house_rules_history?: HouseRules[];
  calendar_feeds?: CalendarFeed[];
  calendar_facts?: CalendarFact[];
  calendar_refreshed_at?: IsoString;
  calendar_errors?: string[];
  /** Newest first. */
  radar_runs?: RadarRun[];
  /** Who started this week's shared sweep, so the other person's radar skips it. */
  radar_claim?: { uid: string; at: IsoString };
  /** 2 once existing tasks were moved to the simpler model (every task has a person; dates place tasks). */
  schema?: number;
  /** Notifications: the Worker publishes its VAPID public key here; phones subscribe with it. */
  push_public_key?: string;
  push_subscriptions?: Record<string, PushSubscriptionRecord>;
  notify?: Record<string, NotifyPrefs>;
  /** The day each person's digest last went out, so it's sent once a day. Written by the Worker. */
  digest_sent?: Record<string, DateString>;
  /** Bug reports and ideas waiting to become GitHub issues (see .github/workflows/feedback.yml). */
  feedback?: Record<string, FeedbackRecord>;
}

/** Whose tasks to show: their uids. Empty = everyone's. */
export type Filter = string[];
