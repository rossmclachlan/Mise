import { useState } from 'react';
import { Check, GripVertical, Link2, Lock, Repeat, StickyNote } from 'lucide-react';
import type { Task } from '../types';
import { formatDate, formatShort, localDay, relativeDate } from '../lib/dates';
import { stepProgress } from '../lib/ops';
import { describeRepeat } from '../lib/repeat';
import { usePriorities } from '../state/PrioritiesContext';
import { GAPS_EMOJI, initial, outcomeLine } from '../lib/format';

// Each household member keeps one colour: the first sun, the second lilac.
const MEMBER_CHIP = [
  'border-ink bg-sun text-ink',
  'border-on-second-container bg-second-container text-on-second-container',
];

/** Whose a task is: a lock for a private one; R, E or R+E on shared ones. */
export function OwnerChip({ task }: { task: Task }) {
  const { nameOf, household } = usePriorities();
  if (task.list !== 'shared') {
    return (
      <span
        role="img"
        aria-label="Private"
        title="Private: only you can see this"
        className="flex h-6 min-w-7 items-center justify-center rounded-full border border-outline px-2 text-ink-variant"
      >
        <Lock size={13} strokeWidth={2.5} />
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

/** The quiet line under a task's title: when to start, when it's due, rhythm, steps. */
export function TaskMeta({ task, now }: { task: Task; now: string }) {
  const parts: { text: string; late?: boolean }[] = [];
  const rel = (d: string) => {
    const r = relativeDate(d, now);
    return r === 'Today' || r === 'Tomorrow' ? r.toLowerCase() : r;
  };
  const { do_by: start, deadline: due } = task;
  if (start && (!due || start < due) && !(due && due < now)) {
    parts.push(start < now ? { text: `Start by ${formatShort(start)}`, late: true } : { text: `Start ${rel(start)}` });
  }
  if (due) {
    const lead = parts.length ? 'due' : 'Due';
    parts.push(due < now ? { text: `Was due ${formatDate(due)}`, late: true } : { text: `${lead} ${rel(due)}` });
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
    <span className="flex w-full min-w-0 items-center gap-1 text-[13px] text-ink-variant">
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
          {task.kind === 'check' && <span aria-label="Potential gap">{GAPS_EMOJI} </span>}
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

/**
 * Who a task is on: me, the other person, or both of us. When it's just me,
 * it can also be private (only I can see it).
 */
export function WhoPicker({
  assignee,
  isPrivate,
  onChange,
}: {
  assignee: string[];
  isPrivate: boolean;
  onChange: (assignee: string[], isPrivate: boolean) => void;
}) {
  const { user, otherUid, nameOf } = usePriorities();
  const options: { label: string; value: string[] }[] = [
    { label: nameOf(user.uid), value: [user.uid] },
    ...(otherUid ? [{ label: nameOf(otherUid), value: [otherUid] }, { label: 'Both', value: [user.uid, otherUid] }] : []),
  ];
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const justMe = same(assignee, [user.uid]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={same(o.value, assignee)}
            className={`chip flex-1 ${same(o.value, assignee) ? 'chip-on' : ''}`}
            onClick={() => onChange(o.value, same(o.value, [user.uid]) && isPrivate)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {justMe && (
        <button
          type="button"
          role="switch"
          aria-checked={isPrivate}
          onClick={() => onChange(assignee, !isPrivate)}
          className="flex items-center justify-between gap-3 text-left text-sm text-ink"
        >
          <span className="flex items-center gap-1.5">
            <Lock size={14} /> Private, only I can see it
          </span>
          <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${isPrivate ? 'bg-accent' : 'bg-outline'}`}>
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-[left] ${isPrivate ? 'left-[1.125rem]' : 'left-0.5'}`}
            />
          </span>
        </button>
      )}
    </div>
  );
}

/** One chip per person; tap to show or hide their tasks. None on = nothing shown. */
export function PeopleChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { household, nameOf } = usePriorities();
  return (
    <div className="flex gap-2" role="group" aria-label="Whose tasks">
      {household.members.map((m, i) => {
        const on = value.includes(m);
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m])}
            className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-1.5 text-sm font-bold transition-colors ${
              on ? (MEMBER_CHIP[i] ?? 'border-ink bg-accent text-white') : 'border-outline bg-surface text-ink-variant'
            }`}
          >
            {on && <Check size={14} strokeWidth={3} />}
            {nameOf(m)}
          </button>
        );
      })}
    </div>
  );
}
