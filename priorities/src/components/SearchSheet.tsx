import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Horizon, Task } from '../types';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { formatShort, localDay, today } from '../lib/dates';
import { effectiveHorizon, isHandledAhead } from '../lib/horizon';
import { compareOpen } from '../lib/ops';
import { matchesSearch } from '../lib/search';
import { canSee } from '../lib/visibility';
import { GAPS_EMOJI, HANDLED_EMOJI, HANDLED_NAME, HORIZON_EMOJI, HORIZON_NAMES, formatWhen } from '../lib/format';
import { usePriorities } from '../state/PrioritiesContext';
import { OwnerChip } from './bits';

const HORIZON_ORDER: Horizon[] = ['now', 'month', 'later'];
const MAX_RESULTS = 50;

/**
 * Finds any task you can see, open or done, whoever it's on (the name chips
 * don't apply), and says where each one lives.
 */
export function SearchSheet({ isOpen, onClose, onOpen }: { isOpen: boolean; onClose: () => void; onOpen: (id: string) => void }) {
  return (
    <BottomSheet dialogOnWide isOpen={isOpen} onClose={onClose} tall>
      {isOpen && <Body onOpen={onOpen} />}
    </BottomSheet>
  );
}

function Body({ onOpen }: { onOpen: (id: string) => void }) {
  const { tasks, user, nameOf } = usePriorities();
  const [q, setQ] = useState('');
  const now = today();

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const found = tasks.filter((t) => canSee(t, user.uid) && matchesSearch(t, q));
    const open = found
      .filter((t) => !t.done_at)
      .sort(
        (a, b) =>
          HORIZON_ORDER.indexOf(effectiveHorizon(a, now)) - HORIZON_ORDER.indexOf(effectiveHorizon(b, now)) || compareOpen(a, b),
      );
    const done = found.filter((t) => t.done_at).sort((a, b) => (a.done_at! > b.done_at! ? -1 : 1));
    return [...open, ...done];
  }, [tasks, user.uid, q, now]);

  function where(t: Task): string {
    if (t.done_at) return isHandledAhead(t, now) ? `${HANDLED_EMOJI} ${HANDLED_NAME}` : '✓ Done';
    const h = effectiveHorizon(t, now);
    return `${HORIZON_EMOJI[h]} ${HORIZON_NAMES[h]}`;
  }

  function who(t: Task): string {
    if (t.list !== 'shared') return 'Private';
    return t.assignee.map(nameOf).join(' & ');
  }

  function dates(t: Task): string {
    if (t.done_at) {
      const parts = [`Done ${formatShort(localDay(t.done_at))} by ${nameOf(t.done_by)}`];
      if (t.when) parts.unshift(formatWhen(t.when, t.when_end));
      return parts.join(' · ');
    }
    const parts: string[] = [];
    if (t.do_by) parts.push(`Start by ${formatShort(t.do_by)}`);
    if (t.deadline) parts.push(`Due ${formatShort(t.deadline)}`);
    return parts.join(' · ') || 'No date';
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 pt-1">
      <label className="flex items-center gap-2 rounded-xl border border-outline bg-surface px-3">
        <Search size={18} className="text-ink-variant" />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search all tasks: titles, notes, steps"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base focus:outline-none"
        />
      </label>

      {q.trim() && results.length === 0 && <p className="py-6 text-center text-sm text-ink-variant">No matches.</p>}

      {results.length > 0 && (
        <div className="card divide-y divide-outline px-3">
          {results.slice(0, MAX_RESULTS).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpen(t.id)}
              className="flex w-full items-start gap-3 py-2.5 text-left"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`line-clamp-2 break-words text-[15px] font-semibold ${t.done_at ? 'text-ink-variant' : 'text-ink'}`}
                >
                  {t.kind === 'check' && !t.done_at && <span aria-label="Potential gap">{GAPS_EMOJI} </span>}
                  {t.title}
                </span>
                <span className="text-[13px] font-semibold text-ink">
                  {where(t)} · {who(t)}
                </span>
                <span className="text-[13px] text-ink-variant">{dates(t)}</span>
              </span>
              <OwnerChip task={t} />
            </button>
          ))}
        </div>
      )}
      {results.length > MAX_RESULTS && (
        <p className="text-center text-xs text-ink-variant">Showing the first {MAX_RESULTS}. Add a word to narrow it down.</p>
      )}
    </div>
  );
}
