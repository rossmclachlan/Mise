import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { Filter, Horizon, Task } from '../types';
import { PillToggle } from '../../../src/components/ui/PillToggle';
import { addDays, today, weekEnd } from '../lib/dates';
import {
  MONTH_DAYS,
  effectiveHorizon,
  isComingUp,
  isDoneThisWeek,
  isTakenCareOfSoon,
} from '../lib/horizon';
import { compareOpen } from '../lib/ops';
import { usePriorities } from '../state/PrioritiesContext';
import { useVisible } from '../state/useVisible';
import { Header } from './Header';
import { TakenCareRow, TaskRow } from './bits';
import { NowList } from './NowList';
import { QuickAddSheet } from './QuickAddSheet';
import { TaskSheet } from './TaskSheet';
import { DoneView } from './DoneView';
import { BottomNav, SideNav, type Section } from './Nav';
import { DoneToast, type ToastState } from './DoneToast';
import { DoneDetailsSheet } from './DoneDetailsSheet';

const FILTER_KEY = 'priorities:filter';
const SECTION_KEY = 'priorities:section';

function loadSection(): Section {
  try {
    return localStorage.getItem(SECTION_KEY) === 'done' ? 'done' : 'open';
  } catch {
    return 'open';
  }
}

function loadFilter(): Filter {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    if (v === 'mine' || v === 'shared' || v === 'everything') return v;
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return 'mine';
}

export function Home() {
  const { user, nameOf, complete, reopen } = usePriorities();
  const [filter, setFilter] = useState<Filter>(loadFilter);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [section, setSection] = useState<Section>(loadSection);
  const [expanded, setExpanded] = useState<Record<'month' | 'later', boolean>>({ month: false, later: false });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, filter);
    } catch {
      // See loadFilter.
    }
  }, [filter]);

  // The undo toast dismisses itself; a newer toast restarts the clock.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_KEY, section);
    } catch {
      // See loadFilter.
    }
  }, [section]);

  const now = today();
  const visible = useVisible(filter);
  // Taken care of always includes everything shared: seeing that the other
  // person has handled something is the point, whoever it was assigned to.
  const handledPool = useVisible('everything');
  const { tasks } = usePriorities();

  const sections = useMemo(() => {
    const open = visible.filter((t) => !t.done_at);
    const by = (h: Horizon) => open.filter((t) => effectiveHorizon(t, now) === h);
    const comingUp = handledPool.filter((t) => isComingUp(t, now));
    const monthEnd = addDays(now, MONTH_DAYS);
    return {
      now: by('now').sort((a, b) => a.rank - b.rank),
      month: by('month').sort(compareOpen),
      later: by('later').sort(compareOpen),
      soon: handledPool
        .filter((t) => isTakenCareOfSoon(t, now))
        .sort((a, b) => (a.when! < b.when! ? -1 : 1)),
      doneThisWeek: handledPool.filter((t) => isDoneThisWeek(t, now)).length,
      handledMonth: comingUp.filter((t) => t.when! > weekEnd(now) && t.when! <= monthEnd).length,
      handledLater: comingUp.filter((t) => t.when! > monthEnd).length,
    };
  }, [visible, handledPool, now]);

  const openTask = tasks.find((t) => t.id === openId) ?? null;
  const detailsTask = tasks.find((t) => t.id === detailsId) ?? null;

  async function tick(task: Task) {
    const { nextId } = await complete(task);
    setToast({ taskId: task.id, title: task.title, nextId });
  }

  async function undo() {
    if (!toast) return;
    const task = tasks.find((t) => t.id === toast.taskId);
    if (task) await reopen(task, toast.nextId);
    setToast(null);
  }

  const countLabel =
    filter === 'mine' ? `${sections.now.length} for ${nameOf(user.uid)}` : `${sections.now.length}`;

  const filterToggle = (
    <div className="flex justify-center md:justify-start">
      <PillToggle
        options={[
          { label: 'Mine', value: 'mine' },
          { label: 'Shared', value: 'shared' },
          { label: 'Everything', value: 'everything' },
        ]}
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
      />
    </div>
  );

  const nowSection = (
    <section>
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">Now · this week</h2>
        <span className="text-sm text-ink-variant">{countLabel}</span>
      </div>
      {sections.now.length === 0 ? (
        <p className="card px-4 py-5 text-center text-sm text-ink-variant">Nothing on this week. Enjoy it.</p>
      ) : (
        <NowList tasks={sections.now} now={now} onTick={tick} onOpen={setOpenId} />
      )}
    </section>
  );

  const takenCareOf = (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">Taken care of</h2>
        <button type="button" onClick={() => setSection('done')} className="text-sm text-ink-variant">
          {sections.doneThisWeek > 0 && `${sections.doneThisWeek} done this week · `}
          <span className="font-semibold text-accent">See all</span>
        </button>
      </div>
      {sections.soon.length === 0 ? (
        <p className="rounded-2xl border border-good/30 bg-good-container/50 px-4 py-4 text-sm text-ink-variant">
          Nothing booked for the next four weeks yet. When you finish something with a date ahead, like an
          appointment, it shows here.
        </p>
      ) : (
        <div className="divide-y divide-good/15 rounded-2xl border border-good/30 bg-good-container/50 px-3">
          {sections.soon.map((t) => (
            <TakenCareRow key={t.id} task={t} onOpen={() => setOpenId(t.id)} />
          ))}
        </div>
      )}
    </section>
  );

  const laterSections = (['month', 'later'] as const).map((h) => {
    const list = sections[h];
    const handled = h === 'month' ? sections.handledMonth : sections.handledLater;
    const counts = [`${list.length} to do`, handled > 0 ? `${handled} taken care of` : null].filter(Boolean).join(' · ');
    return (
      <section key={h} className="card px-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => ({ ...e, [h]: !e[h] }))}
          className="flex w-full items-center justify-between py-3.5"
          aria-expanded={expanded[h]}
        >
          <span className="text-[15px] font-bold text-ink">{h === 'month' ? 'This month' : 'Later'}</span>
          <span className="flex items-center gap-1 text-sm text-ink-variant">
            {counts}
            <ChevronDown size={18} className={`transition-transform ${expanded[h] ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {expanded[h] && (
          <div className="divide-y divide-outline border-t border-outline">
            {list.length === 0 && <p className="py-4 text-sm text-ink-variant">Nothing here.</p>}
            {list.map((t) => (
              <TaskRow key={t.id} task={t} now={now} onTick={() => tick(t)} onOpen={() => setOpenId(t.id)} />
            ))}
          </div>
        )}
      </section>
    );
  });

  return (
    <>
      <Header />
      <div className="flex min-h-0 flex-1">
        <SideNav active={section} onChange={setSection} openCount={sections.now.length} onAdd={() => setAdding(true)} />
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-6">
            {section === 'open' ? (
              <div className="space-y-6">
                {filterToggle}
                {/* One column on phones; on wide screens Now sits beside everything else. */}
                <div className="grid gap-6 md:grid-cols-2 md:items-start">
                  <div className="space-y-6">{nowSection}</div>
                  <div className="space-y-6">
                    {takenCareOf}
                    {laterSections}
                  </div>
                </div>
              </div>
            ) : (
              <DoneView onOpen={setOpenId} />
            )}
          </div>
        </main>
      </div>
      <BottomNav active={section} onChange={setSection} openCount={sections.now.length} />

      {/* Phones only: sits above the bottom nav, clear of anything pinned to the screen's edge. */}
      <button
        type="button"
        onClick={() => setAdding(true)}
        aria-label="Add a task"
        className="fab fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 z-20 md:hidden"
      >
        <Plus size={26} />
      </button>

      {toast && (
        <DoneToast
          toast={toast}
          onUndo={undo}
          onDetails={() => {
            setDetailsId(toast.taskId);
            setToast(null);
          }}
        />
      )}

      <QuickAddSheet isOpen={adding} onClose={() => setAdding(false)} defaultList={filter === 'mine' ? 'personal' : 'shared'} />
      <TaskSheet task={openTask} onClose={() => setOpenId(null)} onDone={(t) => { setOpenId(null); setDetailsId(t.id); }} />
      <DoneDetailsSheet task={detailsTask} onClose={() => setDetailsId(null)} />
    </>
  );
}
