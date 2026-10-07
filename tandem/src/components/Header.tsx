import { useState } from 'react';
import { Copy, LogOut, UtensilsCrossed } from 'lucide-react';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { emojiPairFor } from '../lib/emoji';
import { formatDate, today } from '../lib/dates';
import { useTandem } from '../state/TandemContext';
import { initial } from '../lib/format';

export function Header() {
  const { user, household, nameOf, store } = useTandem();
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
      <header className="z-40 flex shrink-0 items-center justify-between border-b border-outline bg-surface px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)]">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl" role="img" aria-label="Tandem">
            {emoji}
          </span>
          <span className="text-sm text-ink-variant">{formatDate(today())}</span>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Menu"
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-accent-container font-semibold text-on-accent-container active:opacity-80"
        >
          {initial(myName)}
          {alone && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent" />}
        </button>
      </header>

      <BottomSheet isOpen={menuOpen} onClose={() => setMenuOpen(false)} title={myName}>
        <div className="flex flex-col gap-4 pb-4">
          <p className="truncate text-sm text-ink-variant">{user.email}</p>

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

          <a href="/Mise/" className="btn-outlined w-full">
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
