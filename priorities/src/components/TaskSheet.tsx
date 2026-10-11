import { useState } from 'react';
import { Check, ChevronDown, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import type { RepeatRule, Step, Task } from '../types';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { formatDate, formatShort, localDay, today } from '../lib/dates';
import { effectiveHorizon } from '../lib/horizon';
import { newId } from '../lib/ops';
import { describeRepeat, nextOccurrence } from '../lib/repeat';
import { usePriorities } from '../state/PrioritiesContext';
import { GAPS_EMOJI, formatWhen } from '../lib/format';
import { DateField, justPickedDate } from './DateField';
import { ReminderField } from './ReminderField';
import { WhoPicker } from './bits';

export function TaskSheet({
  task,
  onClose,
  onDone,
  onDetails,
}: {
  task: Task | null;
  onClose: () => void;
  /** Marks it done straight away (the toast offers Undo and Add details). */
  onDone: (t: Task) => void;
  /** Opens the outcome sheet for a done task. */
  onDetails: (t: Task) => void;
}) {
  return (
    <BottomSheet dialogOnWide isOpen={task !== null} onClose={onClose} tall>
      {task && <Body key={task.id} task={task} onClose={onClose} onDone={onDone} onDetails={onDetails} />}
    </BottomSheet>
  );
}

const REPEAT_PRESETS: { label: string; rule: Omit<RepeatRule, 'mode'> | null }[] = [
  { label: 'Never', rule: null },
  { label: 'Every week', rule: { every: 1, unit: 'week' } },
  { label: 'Every 2 weeks', rule: { every: 2, unit: 'week' } },
  { label: 'Every month', rule: { every: 1, unit: 'month' } },
  { label: 'Every 3 months', rule: { every: 3, unit: 'month' } },
  { label: 'Every 6 months', rule: { every: 6, unit: 'month' } },
  { label: 'Every year', rule: { every: 1, unit: 'year' } },
];

function presetIndex(rule: RepeatRule | null): number {
  if (!rule) return 0;
  const i = REPEAT_PRESETS.findIndex((p) => p.rule?.every === rule.every && p.rule?.unit === rule.unit);
  return i < 0 ? 0 : i;
}

function Body({
  task,
  onClose,
  onDone,
  onDetails,
}: {
  task: Task;
  onClose: () => void;
  onDone: (t: Task) => void;
  onDetails: (t: Task) => void;
}) {
  const t = usePriorities();
  const { user, nameOf, update } = t;
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState('');
  const [stepTitle, setStepTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const now = today();
  const done = task.done_at !== null;
  const gap = task.kind === 'check' && !done;

  const saveTitle = () => {
    if (title.trim() && title.trim() !== task.title) update(task, { title: title.trim() }, 'renamed');
  };

  function setWho(assignee: string[], isPrivate: boolean) {
    if (isPrivate) {
      if (task.list !== 'personal') update(task, { list: 'personal', owner_uid: user.uid, assignee: [user.uid] }, 'made it private');
      return;
    }
    const names = assignee.map(nameOf).join(' & ');
    update(task, { list: 'shared', owner_uid: null, assignee }, task.list === 'personal' ? `shared it, on ${names}` : `assigned to ${names}`);
  }

  function setRepeat(index: number) {
    const preset = REPEAT_PRESETS[index].rule;
    if (!preset) {
      update(task, { repeat: null }, 'stopped repeating');
      return;
    }
    // Keeps an existing after-done rhythm (Claude can set one); new repeats follow the calendar.
    const rule: RepeatRule = { ...preset, mode: task.repeat?.mode ?? 'schedule' };
    // A repeat needs a date to count from.
    const changes: Partial<Task> = { repeat: rule };
    if (!task.do_by && !task.deadline) changes.deadline = now;
    update(task, changes, `repeats ${describeRepeat(rule)}`);
  }

  function addStep(e: React.FormEvent) {
    e.preventDefault();
    if (!stepTitle.trim()) return;
    const step: Step = { id: newId(), title: stepTitle.trim(), done_at: null };
    t.setSteps(task, [...task.steps, step], 'added a step');
    setStepTitle('');
  }

  async function tickStep(step: Step) {
    const doneAt = step.done_at ? null : new Date().toISOString();
    const steps = task.steps.map((s) => (s.id === step.id ? { ...s, done_at: doneAt } : s));
    await t.setSteps(task, steps, doneAt ? `finished “${step.title}”` : `reopened “${step.title}”`);
    // Finishing the last step finishes the task (the toast offers Undo).
    if (doneAt && steps.every((s) => s.done_at) && !done) onDone({ ...task, steps });
  }

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    t.addNote(task, note);
    setNote('');
  }

  const added = task.history[0];
  const latest = task.history.length > 1 ? task.history.at(-1) : null;
  const who = (h: { uid: string; via: string }) => `${nameOf(h.uid)}${h.via === 'mcp' ? ' via Claude' : ''}`;
  const nextDue =
    task.repeat && done ? nextOccurrence(task.repeat, task.do_by ?? task.deadline, localDay(task.done_at!)) : null;
  const startLate = !done && task.do_by !== null && task.do_by < now;

  // What's behind More, so it's clear before opening it.
  const inside = [
    !done && task.do_by && 'Start by',
    task.repeat && describeRepeat(task.repeat),
    task.steps.length > 0 && `${task.steps.filter((s) => s.done_at).length} of ${task.steps.length} steps`,
    task.notes.length > 0 && `${task.notes.length} ${task.notes.length === 1 ? 'note' : 'notes'}`,
    task.source_url && 'link',
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="flex items-start gap-2">
        {done && (
          <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-good-container text-good">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          rows={1}
          className="min-w-0 flex-1 resize-none bg-transparent text-xl font-bold text-ink focus:outline-none [field-sizing:content]"
        />
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-ink-variant">
          <X size={22} />
        </button>
      </div>

      {done && (
        <div className="-mt-3 flex flex-col gap-3">
          <p className="text-sm text-ink-variant">
            Done by {nameOf(task.done_by)} · {formatDate(localDay(task.done_at!))}
          </p>
          <button
            type="button"
            onClick={() => onDetails(task)}
            className="rounded-2xl border border-good/40 bg-good-container/60 p-3 text-left"
          >
            <span className="label-section text-on-good-container">Outcome</span>
            {task.when && <p className="mt-1 text-[15px] font-semibold text-ink">{formatWhen(task.when, task.when_end)}</p>}
            <p className="mt-0.5 whitespace-pre-wrap text-[15px] text-ink">
              {task.outcome_note || <span className="text-ink-variant">Add the details we’ll want later</span>}
            </p>
          </button>
        </div>
      )}

      {gap && (
        <p className="-mt-3 rounded-2xl border border-warn/40 bg-warn-container/60 p-3 text-sm text-ink">
          {GAPS_EMOJI} The radar couldn’t confirm this is handled. Tick it done once it is.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="label-section">Who</span>
        <WhoPicker assignee={task.assignee} isPrivate={task.list === 'personal'} onChange={setWho} />
      </div>

      {!done && (
        <div className="flex flex-col gap-1">
          <DateField label="Due" value={task.deadline} onChange={(v) => update(task, { deadline: v, order: null }, 'changed the due date')} />
          {task.do_by && (
            <p className={`text-xs ${startLate ? 'text-late' : 'text-ink-variant'}`}>Start by {formatDate(task.do_by)}</p>
          )}
        </div>
      )}

      {!done && <ReminderField task={task} />}

      <div className="flex flex-wrap gap-2">
        {done ? (
          <button type="button" className="btn-outlined flex-1" onClick={() => !justPickedDate() && t.reopen(task)}>
            Reopen
          </button>
        ) : (
          <>
            <button type="button" className="btn-filled flex-1" onClick={() => !justPickedDate() && onDone(task)}>
              <Check size={18} /> Done
            </button>
            {effectiveHorizon(task, now) === 'now' && (
              <button type="button" className="btn-outlined flex-1" onClick={() => !justPickedDate() && t.notThisWeek(task)}>
                Not this week
              </button>
            )}
            {task.repeat && (
              <button type="button" className="btn-outlined flex-1" onClick={() => !justPickedDate() && t.skip(task)}>
                Skip this time
              </button>
            )}
          </>
        )}
      </div>

      <div className="border-t-[1.5px] border-outline pt-3">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-sm font-bold text-ink">More</span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-ink-variant">
            <span className="truncate">{inside.join(' · ')}</span>
            <ChevronDown size={16} className={`shrink-0 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {moreOpen && (
          <div className="mt-4 flex flex-col gap-5">
            {!done && (
              <div className="flex flex-col gap-1">
                <DateField
                  label="Start by"
                  value={task.do_by}
                  onChange={(v) => update(task, { do_by: v, order: null }, 'changed the start date')}
                />
                <p className="text-xs text-ink-variant">
                  For things that need lead time, like a booking. It shows up from this date instead of the due date.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="label-section">Repeats</span>
              <select
                value={presetIndex(task.repeat)}
                onChange={(e) => setRepeat(Number(e.target.value))}
                className="input-field min-w-0 py-2"
              >
                {REPEAT_PRESETS.map((p, i) => (
                  <option key={p.label} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
              {nextDue && <p className="text-xs text-ink-variant">Next one: {formatDate(nextDue)}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="label-section">
                Steps{task.steps.length > 0 && ` · ${task.steps.filter((s) => s.done_at).length} of ${task.steps.length}`}
              </span>
              {task.steps.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => tickStep(s)}
                    aria-label={s.done_at ? `Reopen ${s.title}` : `Finish ${s.title}`}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      s.done_at ? 'border-good bg-good-container text-good' : 'border-outline text-transparent'
                    }`}
                  >
                    <Check size={13} strokeWidth={3} />
                  </button>
                  <span className={`min-w-0 flex-1 text-[15px] ${s.done_at ? 'text-ink-variant line-through' : 'text-ink'}`}>
                    {s.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => t.setSteps(task, task.steps.filter((x) => x.id !== s.id), 'removed a step')}
                    aria-label={`Remove ${s.title}`}
                    className="p-1 text-ink-variant"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <form onSubmit={addStep} className="flex items-center gap-2">
                <Plus size={18} className="shrink-0 text-ink-variant" />
                <input
                  value={stepTitle}
                  onChange={(e) => setStepTitle(e.target.value)}
                  placeholder="Add a step"
                  className="min-w-0 flex-1 border-b border-outline bg-transparent py-1.5 text-[15px] focus:border-accent focus:outline-none"
                />
              </form>
            </div>

            <div className="flex flex-col gap-2">
              <span className="label-section">Notes</span>
              {task.source_url && (
                <a href={task.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-accent">
                  <ExternalLink size={14} /> Open the source
                </a>
              )}
              {task.notes.map((n) => (
                <div key={n.id}>
                  <p className="text-xs text-ink-variant">
                    {nameOf(n.uid)}
                    {n.via === 'mcp' && ' via Claude'} · {formatShort(localDay(n.at))}
                  </p>
                  <p className="whitespace-pre-wrap text-[15px] text-ink">{n.text}</p>
                </div>
              ))}
              <form onSubmit={addNote} className="flex gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note"
                  className="input-field min-w-0 flex-1 py-2"
                />
                <button type="submit" disabled={!note.trim()} className="btn-tonal px-4">
                  Add
                </button>
              </form>
            </div>

            {added && (
              <p className="text-xs text-ink-variant">
                Added by {who(added)}, {formatShort(localDay(added.at))}
                {latest && `; ${latest.what} by ${who(latest)}, ${formatShort(localDay(latest.at))}`}
              </p>
            )}

            {confirmDelete ? (
              <button
                type="button"
                className="btn-danger w-full"
                onClick={async () => {
                  await t.remove(task);
                  onClose();
                }}
              >
                <Trash2 size={16} /> Really delete?
              </button>
            ) : (
              <button type="button" className="btn-danger w-full" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
