import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { Filter, Horizon, Task } from '../types';
import { today } from '../lib/dates';
import { effectiveHorizon } from '../lib/horizon';
import { compareOpen } from '../lib/ops';
import { HORIZON_EMOJI, HORIZON_NAMES } from '../lib/format';
import { Seal } from '../../../src/components/ui/Seal';
import { usePriorities } from '../state/PrioritiesContext';
import { useVisible } from '../state/useVisible';
import { Header } from './Header';
import { PeopleChips } from './bits';
import { ReorderList } from './ReorderList';
import { HouseRulesView } from './HouseRulesView';
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
    const v = localStorage.getItem(SECTION_KEY);
    return v === 'done' || v === 'rules' ? v : 'open';
  } catch {
    return 'open';
  }
}

function loadFilter(uid: string): Filter {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    if (v === 'mine') return [uid];
    if (v === 'everything' || v === 'shared') return [];
    const parsed: unknown = v ? JSON.parse(v) : null;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed;
  } catch {
    // Storage can be unavailable (private mode), or hold something old; fall back to the default.
  }
  return [uid];
}

export function Home() {
  const { user, nameOf, complete, reopen } = usePriorities();
  const [filter, setFilter] = useState<Filter>(() => loadFilter(user.uid));
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [section, setSection] = useState<Section>(loadSection);
  const [expanded, setExpanded] = useState<Record<'month' | 'later', boolean>>({ month: false, later: false });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
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
  const { tasks } = usePriorities();

  const sections = useMemo(() => {
    // Potential gaps sit among the rest, by date, marked with a ⚠️.
    const open = visible.filter((t) => !t.done_at);
    const by = (h: Horizon) => open.filter((t) => effectiveHorizon(t, now) === h).sort(compareOpen);
    return {
      now: by('now'),
      month: by('month'),
      later: by('later'),
    };
  }, [visible, now]);

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

  const countFor = filter.length === 1 ? `for ${nameOf(filter[0])}` : null;

  const filterToggle = (
    <div className="flex justify-center md:justify-start">
      <PeopleChips value={filter} onChange={setFilter} />
    </div>
  );

  const nowSection = (
    <section>
      <div className="mb-2 flex items-center gap-2.5">
        <h2 className="heading-section">
          {HORIZON_EMOJI.now} {HORIZON_NAMES.now}
        </h2>
        {sections.now.length > 0 && <span className="count-badge">{sections.now.length}</span>}
        {countFor && <span className="ml-auto text-sm text-ink-variant">{countFor}</span>}
      </div>
      {sections.now.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-4 py-6 text-center">
          <Seal emoji="☀️" size={56} tone="sun" />
          <p className="font-display text-xl text-ink">Nothing on this week</p>
          <p className="text-sm text-ink-variant">Go and sit in the sun.</p>
        </div>
      ) : (
        <ReorderList tasks={sections.now} now={now} onTick={tick} onOpen={setOpenId} topThree />
      )}
    </section>
  );

  const laterSections = (['month', 'later'] as const).map((h) => {
    const list = sections[h];
    const counts = `${list.length} to do`;
    return (
      <section key={h} className="card px-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => ({ ...e, [h]: !e[h] }))}
          className="flex w-full items-center justify-between py-3.5"
          aria-expanded={expanded[h]}
        >
          <span className="font-display text-lg text-ink">
            {HORIZON_EMOJI[h]} {HORIZON_NAMES[h]}
            <span className="ml-1.5 hidden font-sans text-sm text-ink-variant sm:inline">
              {h === 'month' ? 'next 6 weeks' : 'revisit later'}
            </span>
          </span>
          <span className="flex items-center gap-1 text-sm text-ink-variant">
            {counts}
            <ChevronDown size={18} className={`transition-transform ${expanded[h] ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {expanded[h] && (
          <div className="border-t border-outline">
            {list.length === 0 ? (
              <p className="py-4 text-sm text-ink-variant">Nothing here.</p>
            ) : (
              <ReorderList tasks={list} now={now} onTick={tick} onOpen={setOpenId} bare />
            )}
          </div>
        )}
      </section>
    );
  });

  return (
    <>
      <Header onHouseRules={() => setSection('rules')} />
      <div className="flex min-h-0 flex-1">
        <SideNav active={section} onChange={setSection} openCount={sections.now.length} onAdd={() => setAdding(true)} />
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-6">
            {section === 'open' ? (
              <div className="space-y-6">
                {filterToggle}
                {/* One column on phones; on wide screens Now sits beside everything else. */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
                  <div className="space-y-6">
                    {nowSection}
                  </div>
                  <div className="space-y-6">{laterSections}</div>
                </div>
              </div>
            ) : section === 'done' ? (
              <DoneView onOpen={setOpenId} />
            ) : (
              <HouseRulesView />
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

      <QuickAddSheet isOpen={adding} onClose={() => setAdding(false)} />
      <TaskSheet
        task={openTask}
        onClose={() => setOpenId(null)}
        onDone={(t) => {
          setOpenId(null);
          tick(t);
        }}
        onDetails={(t) => setDetailsId(t.id)}
      />
      <DoneDetailsSheet task={detailsTask} onClose={() => setDetailsId(null)} />
    </>
  );
}
