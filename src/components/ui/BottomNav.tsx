import { ChefHat, Map, ShoppingCart } from 'lucide-react';
import type { Mode } from '../../types';

interface BottomNavProps {
  active: Mode;
  onChange: (mode: Mode) => void;
}

const TABS: { mode: Mode; label: string; Icon: typeof Map }[] = [
  { mode: 'plan', label: 'Plan', Icon: Map },
  { mode: 'shop', label: 'Shop', Icon: ShoppingCart },
  { mode: 'cook', label: 'Cook', Icon: ChefHat },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="z-40 shrink-0 border-t border-outline bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around py-2">
        {TABS.map(({ mode, label, Icon }) => {
          const isActive = active === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              className="flex flex-1 flex-col items-center gap-1 py-1 text-xs font-medium"
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  isActive ? 'bg-accent-container' : ''
                }`}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? 'text-on-accent-container' : 'text-ink-variant'}
                />
              </span>
              <span
                className={isActive ? 'font-semibold text-on-accent-container' : 'text-ink-variant'}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
