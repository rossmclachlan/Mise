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
import { SearchSheet } from './SearchSheet';

const SECTION_KEY = 'priorities:section';

function loadSection(): Section {
  try {
    const v = localStorage.getItem(SECTION_KEY);
    return v === 'done' || v === 'rules' ? v : 'open';
  } catch {
    return 'open';
  }
}

export function Home() {
  const { user, nameOf, complete, reopen } = usePriorities();
  // Always opens on your own tasks.
  const [filter, setFilter] = useState<Filter>(() => [user.uid]);
  // A notification opens its task: ./?task=<id>.
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(location.search).get('task'));
  const [adding, setAdding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [section, setSection] = useState<Section>(() => (openId ? 'open' : loadSection()));
  const [expanded, setExpanded] = useState<Record<'month' | 'later', boolean>>({ month: false, later: false });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  // Drop ?task= once it's opened, so a reload doesn't open it again.
  useEffect(() => {
    const url = new URL(location.href);
    if (!url.searchParams.has('task')) return;
    url.searchParams.delete('task');
    history.replaceState(null, '', url);
  }, []);

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
      // Storage can be unavailable (private mode).
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

  // A done toast hides once its task is reopened some other way.
  const toastTask = toast ? tasks.find((t) => t.id === toast.taskId) : null;
  const toastStale = toast !== null && (!toastTask || !toastTask.done_at);

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
      {filter.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-ink-variant">Turn on a name above to see their tasks.</p>
      ) : sections.now.length === 0 ? (
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
      <Header onHouseRules={() => setSection('rules')} onSearch={() => setSearching(true)} where={section} />
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

      {toast && !toastStale && (
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
      <SearchSheet
        isOpen={searching}
        onClose={() => setSearching(false)}
        onOpen={(id) => {
          setSearching(false);
          setOpenId(id);
        }}
      />
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
