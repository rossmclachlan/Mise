import { useState } from 'react';
import type { Horizon, ListKind } from '../types';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { usePriorities } from '../state/PrioritiesContext';
import { HORIZON_SHORT } from '../lib/format';
import { VisibilityPicker } from './bits';

/** Title, when, whose. Everything else can be filled in later, or by Claude. */
export function QuickAddSheet({
  isOpen,
  onClose,
  defaultList,
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultList: ListKind;
}) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add a task">
      {isOpen && <Form onClose={onClose} defaultList={defaultList} />}
    </BottomSheet>
  );
}

function Form({ onClose, defaultList }: { onClose: () => void; defaultList: ListKind }) {
  const { addTask, user } = usePriorities();
  const [title, setTitle] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('now');
  const [list, setList] = useState<ListKind>(defaultList);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await addTask({ title, horizon, list, assignee: list === 'shared' ? [user.uid] : [] });
    onClose();
  }

  const chip = (on: boolean) => `chip flex-1 ${on ? 'chip-on' : ''}`;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-1">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        placeholder="e.g. Card for Grandma"
        className="input-field w-full"
      />
      <div className="flex gap-2">
        {(['now', 'month', 'later'] as const).map((h) => (
          <button key={h} type="button" className={chip(horizon === h)} onClick={() => setHorizon(h)}>
            {HORIZON_SHORT[h]}
          </button>
        ))}
      </div>
      <VisibilityPicker value={list} onChange={setList} />
      <button type="submit" disabled={!title.trim()} className="btn-filled w-full">
        Add
      </button>
    </form>
  );
}
