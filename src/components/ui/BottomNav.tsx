import { ChefHat, Map, ShoppingCart } from 'lucide-react';
import type { Mode } from '../../types';

interface BottomNavProps {
  active: Mode;
  onChange: (mode: Mode) => void;
}

const TABS: { mode: Mode; label: string; Icon: typeof Map; bg: string; fg: string }[] = [
  { mode: 'plan',  label: 'Plan',  Icon: Map,          bg: '#DCFCE7', fg: '#14532D' },
  { mode: 'shop',  label: 'Shop',  Icon: ShoppingCart, bg: '#FFEDD5', fg: '#C2410C' },
  { mode: 'cook',  label: 'Cook',  Icon: ChefHat,      bg: '#FEE2E2', fg: '#7F1D1D' },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="z-40 shrink-0 border-t border-outline bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around py-2">
        {TABS.map(({ mode, label, Icon, bg, fg }) => {
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
                style={isActive ? { backgroundColor: bg } : undefined}
                className="flex h-8 w-14 items-center justify-center rounded-full transition-colors"
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={isActive ? { color: fg } : undefined}
                  className={isActive ? '' : 'text-ink-variant'}
                />
              </span>
              <span
                style={isActive ? { color: fg } : undefined}
                className={isActive ? 'font-semibold' : 'text-ink-variant'}
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
