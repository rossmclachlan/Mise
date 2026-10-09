import { BookText, CircleCheckBig, ListTodo, Plus } from 'lucide-react';

/** The two main sections, plus the house rules page (opened from the menu, or the sidebar). */
export type Section = 'open' | 'done' | 'rules';

const ITEMS: { section: Exclude<Section, 'rules'>; label: string; Icon: typeof ListTodo }[] = [
  { section: 'open', label: 'Open', Icon: ListTodo },
  { section: 'done', label: 'Done', Icon: CircleCheckBig },
];

interface NavProps {
  active: Section;
  onChange: (s: Section) => void;
  /** Open-task count for this week, shown beside Open. */
  openCount: number;
}

/** Phones: the two sections as a bottom bar. */
export function BottomNav({ active, onChange, openCount }: NavProps) {
  return (
    <nav className="z-30 shrink-0 border-t border-outline bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-stretch justify-around py-2">
        {ITEMS.map(({ section, label, Icon }) => {
          const on = active === section;
          return (
            <button
              key={section}
              type="button"
              onClick={() => onChange(section)}
              aria-current={on ? 'page' : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-1 text-xs font-medium"
            >
              <span
                className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  on ? 'bg-accent-container text-on-accent-container' : 'text-ink-variant'
                }`}
              >
                <Icon size={22} strokeWidth={on ? 2.5 : 2} />
                {section === 'open' && openCount > 0 && (
                  <span className="absolute -right-0.5 -top-1 min-w-5 rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-white">
                    {openCount}
                  </span>
                )}
              </span>
              <span className={on ? 'text-ink' : 'text-ink-variant'}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Wide screens: the same sections in a sidebar, with Add in place of the floating button. */
export function SideNav({ active, onChange, openCount, onAdd }: NavProps & { onAdd: () => void }) {
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-outline bg-surface px-3 py-5 md:flex">
      <button type="button" onClick={onAdd} className="btn-filled mb-4 w-full">
        <Plus size={18} /> Add a task
      </button>
      {ITEMS.map(({ section, label, Icon }) => {
        const on = active === section;
        return (
          <button
            key={section}
            type="button"
            onClick={() => onChange(section)}
            aria-current={on ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors ${
              on ? 'bg-accent-container text-on-accent-container' : 'text-ink-variant hover:bg-surface-variant'
            }`}
          >
            <Icon size={20} />
            <span className="flex-1 text-left">{label}</span>
            {section === 'open' && openCount > 0 && <span className="text-sm font-medium">{openCount}</span>}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onChange('rules')}
        aria-current={active === 'rules' ? 'page' : undefined}
        className={`mt-auto flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
          active === 'rules' ? 'bg-accent-container text-on-accent-container' : 'text-ink-variant hover:bg-surface-variant'
        }`}
      >
        <BookText size={18} /> House rules
      </button>
    </nav>
  );
}
