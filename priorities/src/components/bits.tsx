import { useState } from 'react';
import { Check, GripVertical, Link2, Lock, Plus, Repeat, StickyNote, Users } from 'lucide-react';
import type { Task } from '../types';
import { formatDate, formatShort, localDay, relativeDate } from '../lib/dates';
import { effectiveDate, isOverdue } from '../lib/horizon';
import { stepProgress } from '../lib/ops';
import { describeRepeat } from '../lib/repeat';
import { usePriorities } from '../state/PrioritiesContext';
import { formatWhen, initial, outcomeLine } from '../lib/format';

// Each household member keeps one colour: the first sun, the second lilac.
const MEMBER_CHIP = [
  'border-ink bg-sun text-ink',
  'border-on-second-container bg-second-container text-on-second-container',
];

/** Who can see a task, and whose it is: a lock for Just me; R, E, R+E, or a dashed ? on shared ones. */
export function OwnerChip({ task }: { task: Task }) {
  const { nameOf, household } = usePriorities();
  if (task.list !== 'shared') {
    return (
      <span
        role="img"
        aria-label="Just me"
        title="Just me: only you can see this"
        className="flex h-6 min-w-7 items-center justify-center rounded-full border border-outline px-2 text-ink-variant"
      >
        <Lock size={13} strokeWidth={2.5} />
      </span>
    );
  }
  if (task.assignee.length === 0) {
    return (
      <span className="flex h-6 min-w-7 items-center justify-center rounded-full border border-dashed border-ink-variant px-2 text-xs font-semibold text-ink-variant">
        ?
      </span>
    );
  }
  const on = household.members.flatMap((m, i) => (task.assignee.includes(m) ? [i] : []));
  const label = on.map((i) => initial(nameOf(household.members[i]))).join('+');
  const both = on.length > 1;
  return (
    <span
      className={`flex h-6 min-w-7 items-center justify-center rounded-full border-[1.5px] px-2 text-xs font-extrabold ${
        both ? 'border-ink text-ink' : (MEMBER_CHIP[on[0]] ?? 'border-outline text-ink')
      }`}
      style={both ? { background: 'linear-gradient(90deg, var(--color-sun) 50%, var(--color-second-container) 50%)' } : undefined}
    >
      {label}
    </span>
  );
}

/** The quiet line under a task's title: date, rhythm, steps. */
export function TaskMeta({ task, now }: { task: Task; now: string }) {
  const parts: { text: string; late?: boolean }[] = [];
  const date = effectiveDate(task);
  if (date) {
    if (isOverdue(task, now)) parts.push({ text: `Was due ${formatDate(date)}`, late: true });
    else if (!task.do_by && task.deadline === date) parts.push({ text: `Due ${relativeDate(date, now)}` });
    else parts.push({ text: relativeDate(date, now) });
  }
  if (task.repeat) parts.push({ text: describeRepeat(task.repeat, task.do_by ?? task.deadline) });
  const steps = stepProgress(task);
  if (steps.total > 0) {
    parts.push({
      text: `${steps.done} of ${steps.total} steps${steps.next ? ` · next: ${steps.next.title.toLowerCase()}` : ''}`,
    });
  }

  const hasContext = task.notes.length > 0 || task.source_url;
  if (parts.length === 0 && !hasContext) return null;
  return (
    <span className="flex min-w-0 items-center gap-1 text-[13px] text-ink-variant">
      <span className="truncate">
        {parts.map((p, i) => (
          <span key={i} className={p.late ? 'text-late' : undefined}>
            {i > 0 && ' · '}
            {p.text}
          </span>
        ))}
      </span>
      {task.repeat && <Repeat size={12} className="shrink-0" aria-hidden />}
      {task.source_url && <Link2 size={13} className="shrink-0" aria-label="Has a link" />}
      {task.notes.length > 0 && <StickyNote size={12} className="shrink-0" aria-label="Has notes" />}
    </span>
  );
}

const SPROUTS = ['🌱', '🌼', '🍄', '🌻', '🌿', '🌷'];

export function TaskRow({
  task,
  now,
  onTick,
  onOpen,
  dragHandle,
}: {
  task: Task;
  now: string;
  onTick: () => void;
  onOpen: () => void;
  dragHandle?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  // Ticking shows the check and a sprout first, then completes, so the moment is seen.
  const [sprout, setSprout] = useState<string | null>(null);

  function tick() {
    if (sprout) return;
    setSprout(SPROUTS[Math.floor(Math.random() * SPROUTS.length)]);
    setTimeout(onTick, 450);
  }

  return (
    <div className="relative flex items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={tick}
        aria-label={`Mark ${task.title} done`}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
          sprout
            ? 'hg-bounce border-ink bg-accent text-white'
            : 'border-ink-variant/50 bg-surface text-transparent active:border-accent active:text-accent'
        }`}
      >
        <Check size={16} strokeWidth={3} />
      </button>
      {sprout && (
        <span aria-hidden className="hg-pop pointer-events-none absolute left-1 top-0 text-xl">
          {sprout}
        </span>
      )}
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start text-left">
        <span className={`line-clamp-2 w-full break-words text-[15px] font-semibold transition-colors ${sprout ? 'text-ink-variant' : 'text-ink'}`}>
          {task.title}
        </span>
        <TaskMeta task={task} now={now} />
      </button>
      <OwnerChip task={task} />
      {dragHandle && (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="-mr-1 flex h-8 w-6 shrink-0 touch-none items-center justify-center text-ink-variant/60"
          {...dragHandle}
        >
          <GripVertical size={18} />
        </button>
      )}
    </div>
  );
}

export function TakenCareRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { nameOf } = usePriorities();
  const line = outcomeLine(task) || `Done by ${nameOf(task.done_by)}, ${formatShort(localDay(task.done_at!))}`;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 py-2.5 text-left">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-good-container text-good">
        <Check size={14} strokeWidth={3} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 break-words text-[15px] font-semibold text-ink">{task.title}</span>
        <span className="line-clamp-2 text-[13px] text-ink-variant">{line}</span>
      </span>
    </button>
  );
}

/** A potential gap the radar raised: the question, its date, and the two answers. */
export function GapRow({ task, onOpen, onCovered }: { task: Task; onOpen: () => void; onCovered: () => void }) {
  const { update } = usePriorities();
  return (
    <div className="flex flex-col gap-2 py-3">
      <button type="button" onClick={onOpen} className="flex min-w-0 items-start gap-2 text-left">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold text-ink">{task.title}</span>
          <span className="text-[13px] text-ink-variant">
            {[task.when && formatWhen(task.when, task.when_end), task.notes[0]?.text].filter(Boolean).join(' · ')}
          </span>
        </span>
        <OwnerChip task={task} />
      </button>
      <div className="flex gap-2">
        <button type="button" onClick={onCovered} className="chip flex-1 bg-surface">
          <Check size={15} /> We’re covered
        </button>
        <button
          type="button"
          onClick={() => update(task, { kind: 'task', deadline: task.deadline ?? task.when, order: null }, 'added to the list')}
          className="chip flex-1 bg-surface"
        >
          <Plus size={15} /> Needs doing
        </button>
      </div>
    </div>
  );
}

/** Just me or Both of us, with a line saying who can see it. */
export function VisibilityPicker({ value, onChange }: { value: Task['list']; onChange: (v: Task['list']) => void }) {
  const { otherUid, nameOf } = usePriorities();
  const chip = (on: boolean) => `chip ${on ? 'chip-on' : ''}`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <button type="button" className={chip(value === 'personal')} onClick={() => onChange('personal')} aria-pressed={value === 'personal'}>
          <Lock size={15} /> Just me
        </button>
        <button type="button" className={chip(value === 'shared')} onClick={() => onChange('shared')} aria-pressed={value === 'shared'}>
          <Users size={15} /> Both of us
        </button>
      </div>
      <p className="text-xs text-ink-variant">
        {value === 'personal'
          ? 'Only you and your Claude can see this.'
          : otherUid
            ? `${nameOf(otherUid)} (and ${nameOf(otherUid)}’s Claude) can see this too.`
            : 'Anyone who joins the household can see this too.'}
      </p>
    </div>
  );
}
