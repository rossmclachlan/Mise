import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { Filter, Horizon, Task } from '../types';
import { PillToggle } from '../../../src/components/ui/PillToggle';
import { addDays, today, weekEnd } from '../lib/dates';
import {
  WINDOW_DAYS,
  effectiveHorizon,
  isDoneThisWeek,
  isHandledAhead,
  isHandledSoon,
  isOpenCheck,
} from '../lib/horizon';
import { compareOpen } from '../lib/ops';
import { GAPS_EMOJI, GAPS_NAME, HANDLED_EMOJI, HANDLED_NAME, HORIZON_EMOJI, HORIZON_NAMES } from '../lib/format';
import { Seal } from '../../../src/components/ui/Seal';
import { usePriorities } from '../state/PrioritiesContext';
import { useVisible } from '../state/useVisible';
import { Header } from './Header';
import { GapRow, TakenCareRow } from './bits';
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
  // Already handled always includes everything shared: seeing that the other
  // person has handled something is the point, whoever it was assigned to.
  const handledPool = useVisible('everything');
  const { tasks } = usePriorities();

  const sections = useMemo(() => {
    const open = visible.filter((t) => !t.done_at && !isOpenCheck(t));
    const by = (h: Horizon) => open.filter((t) => effectiveHorizon(t, now) === h).sort(compareOpen);
    const ahead = handledPool.filter((t) => isHandledAhead(t, now));
    const windowEnd = addDays(now, WINDOW_DAYS);
    return {
      now: by('now'),
      month: by('month'),
      later: by('later'),
      // A gap is a question for the household: under Mine, show the unclaimed ones too.
      gaps: (filter === 'mine' ? handledPool.filter((t) => t.list === 'personal' || t.assignee.length === 0 || t.assignee.includes(user.uid)) : visible)
        .filter(isOpenCheck)
        .sort((a, b) => ((a.when ?? '') < (b.when ?? '') ? -1 : 1)),
      soon: handledPool.filter((t) => isHandledSoon(t, now)).sort((a, b) => (a.when! < b.when! ? -1 : 1)),
      doneThisWeek: handledPool.filter((t) => isDoneThisWeek(t, now)).length,
      handledMonth: ahead.filter((t) => t.when! > weekEnd(now) && t.when! <= windowEnd).length,
      handledLater: ahead.filter((t) => t.when! > windowEnd).length,
    };
  }, [visible, handledPool, now, filter, user.uid]);

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

  const countFor = filter === 'mine' ? `for ${nameOf(user.uid)}` : null;

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

  // Only there when the radar has a question.
  const gapsSection = sections.gaps.length > 0 && (
    <section>
      <div className="mb-1 flex items-center gap-2.5">
        <h2 className="heading-section">
          {GAPS_EMOJI} {GAPS_NAME}
        </h2>
        <span className="count-badge">{sections.gaps.length}</span>
      </div>
      <p className="mb-2 text-sm text-ink-variant">The radar couldn’t tell whether these are handled.</p>
      <div className="divide-y divide-warn/20 rounded-2xl border border-warn/30 bg-warn-container/50 px-3">
        {sections.gaps.map((t) => (
          <GapRow key={t.id} task={t} onOpen={() => setOpenId(t.id)} onCovered={() => setDetailsId(t.id)} />
        ))}
      </div>
    </section>
  );

  const takenCareOf = (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="heading-section">
          {HANDLED_EMOJI} {HANDLED_NAME}
        </h2>
        <button type="button" onClick={() => setSection('done')} className="text-sm text-ink-variant">
          {sections.doneThisWeek > 0 && `${sections.doneThisWeek} done this week · `}
          <span className="font-semibold text-accent">See all</span>
        </button>
      </div>
      {sections.soon.length === 0 ? (
        <p className="rounded-2xl border-[1.5px] border-dashed border-good bg-good-container/70 px-4 py-4 text-sm text-ink-variant">
          Nothing booked for the next six weeks yet. When you finish something with a date ahead, like an
          appointment or a camp, it shows here.
        </p>
      ) : (
        <div className="divide-y divide-good/20 rounded-2xl border-[1.5px] border-dashed border-good bg-good-container/70 px-3">
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
    const counts = [`${list.length} to do`, handled > 0 ? `${handled} handled` : null].filter(Boolean).join(' · ');
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
                <div className="grid gap-6 md:grid-cols-2 md:items-start">
                  <div className="space-y-6">
                    {nowSection}
                    {gapsSection}
                  </div>
                  <div className="space-y-6">
                    {takenCareOf}
                    {laterSections}
                  </div>
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

      <QuickAddSheet isOpen={adding} onClose={() => setAdding(false)} defaultList={filter === 'mine' ? 'personal' : 'shared'} />
      <TaskSheet task={openTask} onClose={() => setOpenId(null)} onDone={(t) => { setOpenId(null); setDetailsId(t.id); }} />
      <DoneDetailsSheet task={detailsTask} onClose={() => setDetailsId(null)} />
    </>
  );
}
