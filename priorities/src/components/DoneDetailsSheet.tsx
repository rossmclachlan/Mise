import { useState } from 'react';
import type { Task } from '../types';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { usePriorities } from '../state/PrioritiesContext';
import { DateField } from './DateField';

/**
 * The outcome of a task: what we'll want to know later, and the date it's
 * about. For an open task this also marks it done.
 */
export function DoneDetailsSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <BottomSheet
      dialogOnWide
      isOpen={task !== null}
      onClose={onClose}
      title={task?.done_at ? 'Details' : task?.kind === 'check' ? 'We’re covered' : 'Mark done'}
    >
      {task && <Form key={task.id} task={task} onClose={onClose} />}
    </BottomSheet>
  );
}

function Form({ task, onClose }: { task: Task; onClose: () => void }) {
  const { complete, update } = usePriorities();
  const [note, setNote] = useState(task.outcome_note ?? '');
  const [when, setWhen] = useState(task.when);
  const [end, setEnd] = useState(task.when_end ?? null);
  const [busy, setBusy] = useState(false);
  const check = task.kind === 'check' && !task.done_at;

  async function save() {
    setBusy(true);
    const details = { outcome_note: note.trim() || null, when, when_end: when && end && end > when ? end : null };
    if (task.done_at) await update(task, details, 'updated the outcome');
    else await complete(task, details);
    setBusy(false);
    onClose();
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <p className="text-[15px] font-semibold text-ink">{task.title}</p>
      <label className="flex flex-col gap-1">
        <span className="label-section">{check ? 'How it’s covered' : 'Outcome'}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          autoFocus
          placeholder={check ? 'e.g. Grandma has them, or: not needed, we’re away' : 'e.g. Dr. Alvarez, Tue 3:30pm, confirmation #48213'}
          className="input-field resize-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <DateField label="When is it?" value={when} onChange={setWhen} />
        <DateField label="Until (optional)" value={end} onChange={setEnd} />
      </div>
      <p className="-mt-2 text-xs text-ink-variant">
        The appointment, trip or days this covers. It stays under Already handled until then.
      </p>
      <button type="button" onClick={save} disabled={busy} className="btn-filled w-full">
        {task.done_at ? 'Save' : check ? 'Save' : 'Mark done'}
      </button>
    </div>
  );
}
