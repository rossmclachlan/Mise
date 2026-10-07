import { useState } from 'react';
import type { Task } from '../types';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { useTandem } from '../state/TandemContext';
import { DateField } from './DateField';

/**
 * The outcome of a task: what we'll want to know later, and the date it's
 * about. For an open task this also marks it done.
 */
export function DoneDetailsSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <BottomSheet isOpen={task !== null} onClose={onClose} title={task?.done_at ? 'Details' : 'Mark done'}>
      {task && <Form key={task.id} task={task} onClose={onClose} />}
    </BottomSheet>
  );
}

function Form({ task, onClose }: { task: Task; onClose: () => void }) {
  const { complete, update } = useTandem();
  const [note, setNote] = useState(task.outcome_note ?? '');
  const [when, setWhen] = useState(task.when);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const details = { outcome_note: note.trim() || null, when };
    if (task.done_at) await update(task, details, 'updated the outcome');
    else await complete(task, details);
    setBusy(false);
    onClose();
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <p className="text-[15px] font-semibold text-ink">{task.title}</p>
      <label className="flex flex-col gap-1">
        <span className="label-section">Outcome</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          autoFocus
          placeholder="e.g. Dr. Alvarez, Tue 3:30pm, confirmation #48213"
          className="input-field resize-none"
        />
      </label>
      <DateField
        label="When is it?"
        value={when}
        onChange={setWhen}
        hint="The appointment, trip or due date this covers. It stays under Taken care of until then."
      />
      <button type="button" onClick={save} disabled={busy} className="btn-filled w-full">
        {task.done_at ? 'Save' : 'Mark done'}
      </button>
    </div>
  );
}
