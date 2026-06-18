import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { signOut, type User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { BottomSheet } from './BottomSheet';

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
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-container font-semibold text-on-accent-container"
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
      <header className="z-40 flex shrink-0 items-center justify-between border-b border-outline bg-surface px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)]">
        <span className="text-3xl" role="img" aria-label="mis en pizza">
          {logoEmoji}
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

      <BottomSheet isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Account">
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex items-center gap-3">
            <Avatar user={user} size={48} />
            <span className="truncate text-sm font-medium text-ink-variant">
              {user.email}
            </span>
          </div>

          <button type="button" onClick={() => signOut(auth)} className="btn-danger w-full">
            <LogOut size={18} /> Log out
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
