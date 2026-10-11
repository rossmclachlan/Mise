import { X } from 'lucide-react';
import type { Task } from '../types';
import { reminderRecipients } from '../lib/notify';
import { usePriorities } from '../state/PrioritiesContext';
import { markPick } from './DateField';

/** "2026-10-14T09:00" in this phone's time, for a datetime-local input. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatReminder(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** A one-off notification about this task, to whoever's on it. */
export function ReminderField({ task }: { task: Task }) {
  const { user, household, nameOf, update } = usePriorities();
  const value = task.remind_at ?? null;
  const to = reminderRecipients(task, user.uid);
  const subscribed = new Set(Object.values(household.push_subscriptions ?? {}).map((s) => s.uid));
  const missing = to.filter((uid) => !subscribed.has(uid));

  function set(v: string) {
    if (!v) {
      update(task, { remind_at: null }, 'removed the reminder');
      return;
    }
    const iso = new Date(v).toISOString();
    update(task, { remind_at: iso }, `set a reminder for ${formatReminder(iso)}`);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="label-section">Remind me</span>
      <span className="relative flex items-center">
        <input
          type="datetime-local"
          value={value ? toLocalInput(value) : ''}
          onChange={(e) => {
            markPick();
            set(e.target.value);
          }}
          className={`input-field w-full min-w-0 py-2 text-[15px] ${value ? 'pr-9' : ''}`}
        />
        {value && (
          <button
            type="button"
            onClick={() => set('')}
            aria-label="Remove the reminder"
            className="absolute right-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-variant active:bg-surface-variant"
          >
            <X size={16} />
          </button>
        )}
      </span>
      {value && (
        <span className="text-xs text-ink-variant">
          A notification to {to.map((uid) => (uid === user.uid ? 'you' : nameOf(uid))).join(' and ')}
          {missing.length > 0 &&
            `. ${missing.map((uid) => (uid === user.uid ? 'You haven’t' : `${nameOf(uid)} hasn’t`)).join(' and ')} turned notifications on yet (in the menu).`}
        </span>
      )}
    </label>
  );
}
