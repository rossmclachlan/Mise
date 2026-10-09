import { ChefHat, ListChecks, Map, Plus, ShoppingCart } from 'lucide-react';
import type { Mode } from '../../types';

interface BottomNavProps {
  active: Mode;
  onChange: (mode: Mode) => void;
}

// Each mode has its own colour when active: basil, sun, peach.
const TABS: { mode: Mode; label: string; Icon: typeof Map; bg: string }[] = [
  { mode: 'plan',    label: 'Plan',    Icon: Map,          bg: 'bg-second-container' },
  { mode: 'grocery', label: 'Grocery', Icon: ShoppingCart, bg: 'bg-sun' },
  { mode: 'cook',    label: 'Cook',    Icon: ChefHat,      bg: 'bg-accent-container' },
];

/** Phones: the three modes as a bottom bar. */
export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="z-40 shrink-0 border-t-[1.5px] border-outline bg-bg pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-stretch justify-around py-2">
        {TABS.map(({ mode, label, Icon, bg }) => {
          const isActive = active === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              className="flex flex-1 flex-col items-center gap-1 py-1 text-xs"
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  isActive ? `sticker-sm ${bg} text-ink` : 'text-ink-variant'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className={isActive ? 'font-extrabold text-ink' : 'font-semibold text-ink-variant'}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Wide screens: the same modes in a sidebar, with Add a recipe in place of Cook's floating button. */
export function SideNav({ active, onChange, onAddRecipe }: BottomNavProps & { onAddRecipe: () => void }) {
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1.5 border-r-[1.5px] border-outline bg-surface px-3 py-5 md:flex">
      <button type="button" onClick={onAddRecipe} className="btn-filled mb-4 w-full">
        <Plus size={18} /> Add a recipe
      </button>
      {TABS.map(({ mode, label, Icon, bg }) => {
        const isActive = active === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-semibold transition-colors ${
              isActive ? `sticker-sm ${bg} text-ink` : 'border-[1.5px] border-transparent text-ink-variant hover:bg-surface-variant'
            }`}
          >
            <Icon size={20} />
            <span className="flex-1 text-left">{label}</span>
          </button>
        );
      })}
      <a
        href="/Mise/priorities/"
        className="mt-auto flex items-center gap-3 rounded-full border-[1.5px] border-transparent px-4 py-2.5 text-sm font-medium text-ink-variant transition-colors hover:bg-surface-variant"
      >
        <ListChecks size={18} /> Open Priorities
      </a>
    </nav>
  );
}
