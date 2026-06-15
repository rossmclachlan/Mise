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
    <nav className="z-40 shrink-0 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around">
        {TABS.map(({ mode, label, Icon }) => {
          const isActive = active === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium"
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                size={24}
                strokeWidth={isActive ? 2.5 : 2}
                className={isActive ? 'text-accent' : 'text-ink/40'}
              />
              <span className={isActive ? 'text-accent' : 'text-ink/40'}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
