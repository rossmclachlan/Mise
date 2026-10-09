import { Check, GripVertical, Link2, Repeat, StickyNote } from 'lucide-react';
import type { Task } from '../types';
import { formatDate, formatShort, localDay, relativeDate } from '../lib/dates';
import { effectiveDate, isOverdue } from '../lib/horizon';
import { stepProgress } from '../lib/ops';
import { describeRepeat } from '../lib/repeat';
import { usePriorities } from '../state/PrioritiesContext';
import { initial, outcomeLine } from '../lib/format';

/** Who a shared task is on: R, E, R+E, or a dashed ? when nobody has it yet. */
export function OwnerChip({ task }: { task: Task }) {
  const { nameOf, household } = usePriorities();
  if (task.list !== 'shared') return null;
  if (task.assignee.length === 0) {
    return (
      <span className="flex h-6 min-w-7 items-center justify-center rounded-full border border-dashed border-ink-variant px-2 text-xs font-semibold text-ink-variant">
        ?
      </span>
    );
  }
  const label = household.members
    .filter((m) => task.assignee.includes(m))
    .map((m) => initial(nameOf(m)))
    .join('+');
  return (
    <span className="flex h-6 min-w-7 items-center justify-center rounded-full border border-outline px-2 text-xs font-semibold text-ink">
      {label}
    </span>
  );
}

/** The quiet line under a task's title: date, rhythm, steps, privacy. */
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
  if (task.list === 'personal') parts.push({ text: 'personal' });

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
  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={onTick}
        aria-label={`Mark ${task.title} done`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-outline text-transparent transition active:border-good active:text-good"
      >
        <Check size={16} strokeWidth={3} />
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start text-left">
        <span className="w-full truncate text-[15px] font-semibold text-ink">{task.title}</span>
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
        <span className="truncate text-[15px] font-semibold text-ink">{task.title}</span>
        <span className="line-clamp-2 text-[13px] text-ink-variant">{line}</span>
      </span>
    </button>
  );
}
