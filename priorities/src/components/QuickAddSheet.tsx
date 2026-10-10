import { useState } from 'react';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { usePriorities } from '../state/PrioritiesContext';
import { addDays, formatDate, today, weekEnd } from '../lib/dates';
import { DateField } from './DateField';
import { WhoPicker } from './bits';

/**
 * Manual mode: the task, and what you know about it. The due date places it;
 * with none, it sits in Needs action now until the weekly radar dates it.
 * (Most tasks come in through Claude, which fills all this in from the house rules.)
 */
export function QuickAddSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <BottomSheet dialogOnWide isOpen={isOpen} onClose={onClose} title="Add a task">
      {isOpen && <Form onClose={onClose} />}
    </BottomSheet>
  );
}

type DueChoice = 'none' | 'week' | 'next' | 'pick';

function Form({ onClose }: { onClose: () => void }) {
  const { addTask, user } = usePriorities();
  const now = today();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<string[]>([user.uid]);
  const [isPrivate, setPrivate] = useState(false);
  const [choice, setChoice] = useState<DueChoice>('none');
  const [picked, setPicked] = useState<string | null>(null);

  const due =
    choice === 'week' ? weekEnd(now) : choice === 'next' ? addDays(weekEnd(now), 7) : choice === 'pick' ? picked : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await addTask({ title, list: isPrivate ? 'personal' : 'shared', assignee, deadline: due });
    onClose();
  }

  const chip = (c: DueChoice) => `chip flex-1 ${choice === c ? 'chip-on' : ''}`;
  // Tapping the chosen shortcut again clears it: the date is optional.
  const choose = (c: DueChoice) => setChoice(choice === c ? 'none' : c);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-1">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        placeholder="e.g. Fix the gate latch"
        className="input-field w-full"
      />
      <div className="flex flex-col gap-1.5">
        <span className="label-section">
          Due <span className="font-medium normal-case tracking-normal">(optional)</span>
        </span>
        <div className="flex gap-2">
          <button type="button" className={chip('week')} onClick={() => choose('week')} aria-pressed={choice === 'week'}>
            This week
          </button>
          <button type="button" className={chip('next')} onClick={() => choose('next')} aria-pressed={choice === 'next'}>
            Next week
          </button>
          <button type="button" className={chip('pick')} onClick={() => choose('pick')} aria-pressed={choice === 'pick'}>
            Pick a date
          </button>
        </div>
        {choice === 'pick' && <DateField label="Date" value={picked} onChange={setPicked} />}
        {due && choice !== 'pick' && <p className="text-xs text-ink-variant">Due {formatDate(due)}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="label-section">Who</span>
        <WhoPicker
          assignee={assignee}
          isPrivate={isPrivate}
          onChange={(a, p) => {
            setAssignee(a);
            setPrivate(p);
          }}
        />
      </div>
      <button type="submit" disabled={!title.trim()} className="btn-filled w-full">
        Add
      </button>
    </form>
  );
}
