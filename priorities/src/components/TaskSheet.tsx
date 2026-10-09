import { useState } from 'react';
import { Check, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import type { Horizon, RepeatRule, Step, Task } from '../types';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { formatDate, formatShort, localDay, today } from '../lib/dates';
import { effectiveHorizon } from '../lib/horizon';
import { newId } from '../lib/ops';
import { describeRepeat, nextOccurrence } from '../lib/repeat';
import { usePriorities } from '../state/PrioritiesContext';
import { GAPS_EMOJI, HORIZON_SHORT, formatWhen, initial } from '../lib/format';
import { DateField } from './DateField';

export function TaskSheet({
  task,
  onClose,
  onDone,
}: {
  task: Task | null;
  onClose: () => void;
  /** Opens the outcome sheet to mark it done with details. */
  onDone: (t: Task) => void;
}) {
  return (
    <BottomSheet dialogOnWide isOpen={task !== null} onClose={onClose} tall>
      {task && <Body key={task.id} task={task} onClose={onClose} onDone={onDone} />}
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

function Body({ task, onClose, onDone }: { task: Task; onClose: () => void; onDone: (t: Task) => void }) {
  const t = usePriorities();
  const { household, user, nameOf, update } = t;
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState('');
  const [stepTitle, setStepTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = today();
  const done = task.done_at !== null;
  const check = task.kind === 'check' && !done;
  const shared = task.list === 'shared';
  const horizon = effectiveHorizon(task, now);

  const saveTitle = () => {
    if (title.trim() && title.trim() !== task.title) update(task, { title: title.trim() }, 'renamed');
  };

  function setOwner(assignee: string[]) {
    const names = assignee.map(nameOf).join(' & ') || 'nobody';
    update(task, { assignee }, `assigned to ${names}`);
  }

  function setList(list: Task['list']) {
    if (list === task.list) return;
    update(
      task,
      list === 'personal'
        ? { list, owner_uid: user.uid, assignee: [] }
        : { list, owner_uid: null, assignee: [user.uid] },
      list === 'personal' ? 'moved to personal' : 'moved to shared',
    );
  }

  function setRepeat(index: number, mode: RepeatRule['mode']) {
    const preset = REPEAT_PRESETS[index].rule;
    if (!preset) {
      update(task, { repeat: null }, 'stopped repeating');
      return;
    }
    const rule: RepeatRule = { ...preset, mode };
    // A repeat needs a date to count from.
    const changes: Partial<Task> = { repeat: rule };
    if (!task.do_by && !task.deadline) changes.do_by = now;
    update(task, changes, `repeats ${describeRepeat(rule)}`);
  }

  function updateStep(id: string, changes: Partial<Step>, what?: string) {
    t.setSteps(task, task.steps.map((s) => (s.id === id ? { ...s, ...changes } : s)), what);
  }

  function addStep(e: React.FormEvent) {
    e.preventDefault();
    if (!stepTitle.trim()) return;
    const step: Step = { id: newId(), title: stepTitle.trim(), done_at: null, assignee: null, do_by: null };
    t.setSteps(task, [...task.steps, step], 'added a step');
    setStepTitle('');
  }

  async function tickStep(step: Step) {
    const doneAt = step.done_at ? null : new Date().toISOString();
    const steps = task.steps.map((s) => (s.id === step.id ? { ...s, done_at: doneAt } : s));
    await t.setSteps(task, steps, doneAt ? `finished “${step.title}”` : `reopened “${step.title}”`);
    if (doneAt && steps.every((s) => s.done_at) && !done) {
      if (confirm(`That was the last step. Mark “${task.title}” done?`)) onDone({ ...task, steps });
    }
  }

  function cycleStepOwner(step: Step) {
    const order = [null, ...household.members];
    const next = order[(order.indexOf(step.assignee) + 1) % order.length];
    updateStep(step.id, { assignee: next });
  }

  function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    t.addNote(task, note);
    setNote('');
  }

  const chip = (on: boolean) => `chip ${on ? 'chip-on' : ''}`;
  const [other] = household.members.filter((m) => m !== user.uid);
  const ownerOptions: { label: string; value: string[] }[] = [
    { label: nameOf(user.uid), value: [user.uid] },
    ...(other ? [{ label: nameOf(other), value: [other] }, { label: 'Both', value: household.members }] : []),
    { label: 'Unclaimed', value: [] },
  ];
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const added = task.history[0];
  const latest = task.history.length > 1 ? task.history.at(-1) : null;
  const who = (h: { uid: string; via: string }) => `${nameOf(h.uid)}${h.via === 'mcp' ? ' via Claude' : ''}`;
  const nextDue =
    task.repeat && done ? nextOccurrence(task.repeat, task.do_by ?? task.deadline, localDay(task.done_at!)) : null;

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
            onClick={() => onDone(task)}
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

      {check && (
        <div className="-mt-3 rounded-2xl border border-warn/40 bg-warn-container/60 p-3">
          <p className="label-section text-on-warn-container">
            {GAPS_EMOJI} Potential gap{task.when && ` · ${formatWhen(task.when, task.when_end)}`}
          </p>
          <p className="mt-1 text-sm text-ink">
            The radar couldn’t tell whether this is handled. Is it covered, or does something need doing?
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-filled flex-1" onClick={() => onDone(task)}>
              We’re covered
            </button>
            <button
              type="button"
              className="btn-outlined flex-1"
              onClick={() => update(task, { kind: 'task', deadline: task.deadline ?? task.when, order: null }, 'added to the list')}
            >
              Needs doing
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" className={chip(task.list === 'personal')} onClick={() => setList('personal')}>
          Personal
        </button>
        <button type="button" className={chip(shared)} onClick={() => setList('shared')}>
          Shared
        </button>
      </div>

      {shared && (
        <div className="flex flex-col gap-1.5">
          <span className="label-section">Who’s on it</span>
          <div className="flex flex-wrap gap-2">
            {ownerOptions.map((o) => (
              <button
                key={o.label}
                type="button"
                className={chip(sameSet(o.value, task.assignee))}
                onClick={() => setOwner(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!done && !check && (
        <div className="flex flex-col gap-1.5">
          <span className="label-section">When</span>
          <div className="flex gap-2">
            {(['now', 'month', 'later'] as Horizon[]).map((h) => (
              <button key={h} type="button" className={`${chip(horizon === h)} flex-1`} onClick={() => t.moveTo(task, h)}>
                {HORIZON_SHORT[h]}
              </button>
            ))}
          </div>
        </div>
      )}

      {!done && (
        <div className="grid grid-cols-2 gap-3">
          <DateField label="Do by" value={task.do_by} onChange={(v) => update(task, { do_by: v, order: null }, 'changed the do-by date')} />
          <DateField
            label="Deadline"
            value={task.deadline}
            onChange={(v) => update(task, { deadline: v, order: null }, 'changed the deadline')}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="label-section">Repeats</span>
        <div className="flex gap-2">
          <select
            value={presetIndex(task.repeat)}
            onChange={(e) => setRepeat(Number(e.target.value), task.repeat?.mode ?? 'schedule')}
            className="input-field min-w-0 flex-1 py-2"
          >
            {REPEAT_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          {task.repeat && (
            <select
              value={task.repeat.mode}
              onChange={(e) => setRepeat(presetIndex(task.repeat), e.target.value as RepeatRule['mode'])}
              className="input-field min-w-0 flex-1 py-2"
            >
              <option value="schedule">On a schedule</option>
              <option value="after_done">After it’s done</option>
            </select>
          )}
        </div>
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
            <input
              type="date"
              value={s.do_by ?? ''}
              onChange={(e) => updateStep(s.id, { do_by: e.target.value || null }, 'dated a step')}
              aria-label={`Date for ${s.title}`}
              className={`w-[7.5rem] rounded-lg border border-outline bg-surface px-1.5 py-1 text-xs ${s.do_by ? 'text-ink' : 'text-ink-variant'}`}
            />
            {shared && (
              <button
                type="button"
                onClick={() => cycleStepOwner(s)}
                aria-label="Change who does this step"
                className={`flex h-6 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ${
                  s.assignee ? 'border border-outline text-ink' : 'border border-dashed border-ink-variant text-ink-variant'
                }`}
              >
                {s.assignee ? initial(nameOf(s.assignee)) : '?'}
              </button>
            )}
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

      <div className="flex flex-wrap gap-2 pb-2">
        {done ? (
          <button type="button" className="btn-outlined flex-1" onClick={() => t.reopen(task)}>
            Reopen
          </button>
        ) : check ? null : (
          <>
            <button type="button" className="btn-filled flex-1" onClick={() => onDone(task)}>
              <Check size={18} /> Done
            </button>
            {horizon === 'now' && (
              <button type="button" className="btn-outlined flex-1" onClick={() => t.moveTo(task, 'month')}>
                Not this week
              </button>
            )}
            {task.repeat && (
              <button type="button" className="btn-outlined flex-1" onClick={() => t.skip(task)}>
                Skip this time
              </button>
            )}
          </>
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
    </div>
  );
}
