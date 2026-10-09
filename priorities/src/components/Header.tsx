import { useState } from 'react';
import { BookText, Copy, LogOut, UtensilsCrossed } from 'lucide-react';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { LookPicker } from '../../../src/components/ui/LookPicker';
import { Seal } from '../../../src/components/ui/Seal';
import { emojiPairFor } from '../lib/emoji';
import { formatDate, today } from '../lib/dates';
import { usePriorities } from '../state/PrioritiesContext';
import { initial } from '../lib/format';

export function Header({ onHouseRules }: { onHouseRules: () => void }) {
  const { user, household, nameOf, store } = usePriorities();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emoji] = useState(() => emojiPairFor());
  const myName = nameOf(user.uid);
  const alone = household.members.length < 2;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(household.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable; the code is visible to copy by hand.
    }
  }

  return (
    <>
      <header className="z-40 flex shrink-0 items-center justify-between border-b-[1.5px] border-outline bg-bg px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)]">
        <div className="flex items-center gap-2.5">
          <Seal emoji={emoji} size={42} tone="sun" pair label="Priorities" />
          <span className="flex flex-col">
            <span className="font-display text-[24px] leading-none text-accent" aria-hidden>
              priorities
            </span>
            <span className="mt-0.5 text-xs font-semibold text-ink-variant">{formatDate(today())}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Menu"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-ink bg-accent-container font-extrabold text-on-accent-container active:opacity-80"
        >
          {initial(myName)}
          {alone && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-[1.5px] border-ink bg-sun" />}
        </button>
      </header>

      <BottomSheet isOpen={menuOpen} onClose={() => setMenuOpen(false)} title={myName}>
        <div className="flex flex-col gap-4 pb-4">
          <p className="truncate text-sm text-ink-variant">{user.email}</p>

          <LookPicker />

          <div className="rounded-2xl bg-surface-variant p-3">
            <p className="text-sm font-semibold text-ink">
              {alone
                ? 'Invite your partner'
                : `Household: ${household.members.map(nameOf).join(' & ')}`}
            </p>
            <p className="mt-1 text-xs text-ink-variant">
              {alone
                ? 'They sign in, choose “Join with a code” and enter:'
                : 'Household code:'}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-2 flex w-full items-center justify-between rounded-xl bg-surface px-3 py-2 font-mono text-sm text-ink"
            >
              <span className="truncate">{household.id}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-ink-variant">
                <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onHouseRules();
            }}
            className="btn-outlined w-full"
          >
            <BookText size={18} /> House rules and school calendar
          </button>
          <a href="/Mise/meals/" className="btn-outlined w-full">
            <UtensilsCrossed size={18} /> Open Mise (meals)
          </a>
          <button type="button" onClick={() => store.signOut()} className="btn-danger w-full">
            <LogOut size={18} /> Log out
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
