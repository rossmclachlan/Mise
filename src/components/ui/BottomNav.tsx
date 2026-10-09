import { ChefHat, Map, ShoppingCart } from 'lucide-react';
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

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="z-40 shrink-0 border-t-[1.5px] border-outline bg-bg pb-[env(safe-area-inset-bottom)]">
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
