import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ChefHat } from 'lucide-react';
import { auth } from '../../lib/firebase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('Incorrect email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 pb-16">
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-container">
          <ChefHat size={32} className="text-on-accent-container" />
        </div>
        <h1 className="font-display text-4xl text-accent">mis en pizza 🍕</h1>
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

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="btn-filled w-full py-3"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
