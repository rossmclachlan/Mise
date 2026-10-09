import { useState } from 'react';
import { ListChecks, LogOut } from 'lucide-react';
import { signOut, type User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { BottomSheet } from './BottomSheet';
import { LookPicker } from './LookPicker';
import { Seal } from './Seal';

const FOOD_EMOJI = [
  '🍕', '🍔', '🌮', '🍣', '🍜', '🥐', '🍩', '🍰', '🧀', '🥑',
  '🍓', '🍦', '🍿', '🍳', '🥗', '🍇', '🥨', '🍫', '🍪', '🌭',
];

function randomFoodEmoji(): string {
  return FOOD_EMOJI[Math.floor(Math.random() * FOOD_EMOJI.length)];
}

interface TopAppBarProps {
  user: User;
}

function initials(user: User): string {
  if (user.displayName?.trim()) {
    return user.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
  return user.email?.trim()[0]?.toUpperCase() ?? '?';
}

function Avatar({ user, size }: { user: User; size: number }) {
  return (
    <span
      style={{ height: size, width: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-ink bg-accent-container font-extrabold text-on-accent-container"
    >
      {user.photoURL ? (
        <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(user)
      )}
    </span>
  );
}

export function TopAppBar({ user }: TopAppBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoEmoji] = useState(randomFoodEmoji);

  return (
    <>
      <header className="z-40 flex shrink-0 items-center justify-between border-b-[1.5px] border-outline bg-bg px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)]">
        <span className="flex items-center gap-2.5">
          <Seal emoji={logoEmoji} size={42} tone="accent" />
          <span className="font-display text-[28px] leading-none text-accent" role="img" aria-label="mis en pizza">
            mise
          </span>
        </span>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Account menu"
          className="active:opacity-80"
        >
          <Avatar user={user} size={36} />
        </button>
      </header>

      <BottomSheet dialogOnWide isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Settings">
        <div className="flex flex-col gap-4 pb-4">
          <LookPicker />

          <div className="flex items-center gap-3">
            <Avatar user={user} size={48} />
            <span className="truncate text-sm font-medium text-ink-variant">
              {user.email}
            </span>
          </div>

          <a href="/Mise/priorities/" className="btn-outlined w-full">
            <ListChecks size={18} /> Open Priorities (to-dos)
          </a>

          <button type="button" onClick={() => signOut(auth)} className="btn-danger w-full">
            <LogOut size={18} /> Log out
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
