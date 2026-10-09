import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Filter, Task } from '../types';
import { addDays, formatShort, localDay, today, weekEnd, weekStart } from '../lib/dates';
import { MONTH_DAYS, isComingUp } from '../lib/horizon';
import { PillToggle } from '../../../src/components/ui/PillToggle';
import { TakenCareRow } from './bits';
import { useVisible } from '../state/useVisible';

function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups];
}

function matches(task: Task, q: string): boolean {
  const hay = [task.title, task.outcome_note ?? '', ...task.notes.map((n) => n.text), ...task.steps.map((s) => s.title)]
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

/**
 * The Done section: everything handled. Coming up (done, its date still
 * ahead) and the searchable history, side by side on wide screens.
 */
export function DoneView({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('everything');
  const visible = useVisible(filter);
  const now = today();

  const { comingUp, history } = useMemo(() => {
    const done = visible.filter((t) => t.done_at && (!q || matches(t, q)));
    const up = done.filter((t) => isComingUp(t, now)).sort((a, b) => (a.when! < b.when! ? -1 : 1));
    const past = done.filter((t) => !isComingUp(t, now)).sort((a, b) => (a.done_at! > b.done_at! ? -1 : 1));
    const upLabel = (t: Task) =>
      t.when! <= weekEnd(now) ? 'This week' : t.when! <= addDays(now, MONTH_DAYS) ? 'This month' : 'Later';
    const thisWeek = weekStart(now);
    const lastWeek = addDays(thisWeek, -7);
    const pastLabel = (t: Task) => {
      const ws = weekStart(localDay(t.done_at!));
      if (ws === thisWeek) return 'This week';
      if (ws === lastWeek) return 'Last week';
      return `Week of ${formatShort(ws)}`;
    };
    return { comingUp: groupBy(up, upLabel), history: groupBy(past, pastLabel) };
  }, [visible, q, now]);

  const empty = comingUp.length === 0 && history.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-outline bg-surface px-3">
          <Search size={18} className="text-ink-variant" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: checkup, confirmation, passport…"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base focus:outline-none"
          />
        </label>
        <div className="flex justify-center">
          <PillToggle
            options={[
              { label: 'Everything', value: 'everything' },
              { label: 'Mine', value: 'mine' },
              { label: 'Shared', value: 'shared' },
            ]}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
          />
        </div>
      </div>

      {empty && <p className="py-8 text-center text-sm text-ink-variant">{q ? 'No matches.' : 'Nothing done yet.'}</p>}

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        {comingUp.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-bold text-ink">Coming up</h2>
            <p className="mb-3 text-sm text-ink-variant">Handled, with the date still ahead.</p>
            {comingUp.map(([label, items]) => (
              <div key={label} className="mb-3">
                <p className="label-section mb-1">{label}</p>
                <div className="divide-y divide-good/15 rounded-2xl border border-good/30 bg-good-container/50 px-3">
                  {items.map((t) => (
                    <TakenCareRow key={t.id} task={t} onOpen={() => onOpen(t.id)} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {history.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-bold text-ink">History</h2>
            <p className="mb-3 text-sm text-ink-variant">Everything finished, newest first.</p>
            {history.map(([label, items]) => (
              <div key={label} className="mb-3">
                <p className="label-section mb-1">{label}</p>
                <div className="card divide-y divide-outline px-3">
                  {items.map((t) => (
                    <TakenCareRow key={t.id} task={t} onOpen={() => onOpen(t.id)} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
