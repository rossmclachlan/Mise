// Dates without a time are stored as 'YYYY-MM-DD' strings; moments in time as
// full ISO strings. Firestore stores both as plain strings.
export type DateString = string;
export type IsoString = string;

export type ListKind = 'shared' | 'personal';
export type Horizon = 'now' | 'month' | 'later';
export type Via = 'app' | 'mcp';

export interface Step {
  id: string;
  title: string;
  done_at: IsoString | null;
  assignee: string | null;
  do_by: DateString | null;
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
  /** Shared tasks only: who it's on. Empty = unclaimed; both uids = both of us. */
  assignee: string[];
  /** Where the task sits when it has no date. Dated tasks place themselves. */
  horizon: Horizon;
  do_by: DateString | null;
  deadline: DateString | null;
  /** Manual order within Now; lower first. */
  rank: number;
  done_at: IsoString | null;
  done_by: string | null;
  outcome_note: string | null;
  /** The date a done task is about (the appointment, the due date a payment covers). */
  when: DateString | null;
  steps: Step[];
  repeat: RepeatRule | null;
  /** Links the occurrences of a repeating task. */
  series_id: string | null;
  source_url: string | null;
  notes: Note[];
  created_at: IsoString;
  created_by: { uid: string; via: Via };
  history: HistoryEntry[];
}

export interface Household {
  id: string;
  name: string;
  members: string[];
  member_names: Record<string, string>;
}

export type Filter = 'mine' | 'shared' | 'everything';
