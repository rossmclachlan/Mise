import { useState } from 'react';
import type { Store } from '../data/store';
import { emojiPairFor } from '../lib/emoji';

export function LoginScreen({ store }: { store: Store }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await store.signIn(email, password);
    } catch {
      setError('Incorrect email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 pb-16">
      <div className="mb-10 flex flex-col items-center gap-2">
        <span className="text-5xl" aria-hidden>
          {emojiPairFor()}
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-accent">Tandem</h1>
        <p className="text-sm text-ink-variant">Our week, taken care of</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
          className="input-field w-full"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          required
          className="input-field w-full"
        />
        {error && (
          <p className="rounded-xl bg-error-container px-4 py-2.5 text-sm font-medium text-on-error-container">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading || !email || !password} className="btn-filled w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
