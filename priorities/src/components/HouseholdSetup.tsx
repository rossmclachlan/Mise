import { useState } from 'react';
import type { SignedInUser, Store } from '../data/store';

/**
 * First sign-in: one of us starts the household, the other joins it with the
 * code shown in the first person's menu.
 */
export function HouseholdSetup({ store, user }: { store: Store; user: SignedInUser }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'start' | 'join'>('start');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'start') await store.createHousehold(user.uid, name.trim());
      else await store.joinHousehold(code.trim(), user.uid, name.trim());
    } catch {
      setError(
        mode === 'join'
          ? "That code didn't work. Check it, and that the household doesn't already have two people."
          : "Couldn't create the household. Are the Firestore rules deployed?",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col justify-center px-6 pb-16">
      <h1 className="mb-1 text-2xl font-bold text-ink">Welcome to Priorities</h1>
      <p className="mb-6 text-sm text-ink-variant">
        One of us starts the household; the other joins with the code it shows.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label-section">What should we call you?</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            className="input-field mt-1 w-full"
            required
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`chip flex-1 ${mode === 'start' ? 'chip-on' : ''}`}
            onClick={() => setMode('start')}
          >
            Start our household
          </button>
          <button
            type="button"
            className={`chip flex-1 ${mode === 'join' ? 'chip-on' : ''}`}
            onClick={() => setMode('join')}
          >
            Join with a code
          </button>
        </div>
        {mode === 'join' && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Household code"
            className="input-field w-full font-mono"
            required
          />
        )}
        {error && (
          <p className="rounded-xl bg-error-container px-4 py-2.5 text-sm font-medium text-on-error-container">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !name.trim()} className="btn-filled w-full">
          {mode === 'start' ? 'Start' : 'Join'}
        </button>
      </form>
    </div>
  );
}
