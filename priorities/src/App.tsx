import { useEffect, useState } from 'react';
import type { Household, Task } from './types';
import type { SignedInUser, Store } from './data/store';
import { usePWAUpdate } from '../../src/hooks/usePWAUpdate';
import { PrioritiesProvider } from './state/PrioritiesContext';
import { LoginScreen } from './components/LoginScreen';
import { HouseholdSetup } from './components/HouseholdSetup';
import { Home } from './components/Home';

function Spinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-outline border-t-accent" />
    </div>
  );
}

const LOADING = Symbol('loading');

/** Sign-in, setup and error screens stay phone-width, centered on wide screens. */
function Narrow({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex h-full w-full max-w-[480px] flex-col">{children}</div>;
}

/** Shown instead of an endless spinner when Firebase refuses or fails. */
function ErrorScreen({ error, store }: { error: Error; store: Store }) {
  const code = (error as { code?: string }).code;
  return (
    <div className="flex h-full flex-col justify-center gap-4 px-6 pb-16">
      <h1 className="text-xl font-bold text-ink">Priorities couldn't load</h1>
      <p className="text-sm text-ink-variant">
        {code === 'permission-denied'
          ? 'Firebase refused access. Check the Firestore rules are published and this account is on the allowlist.'
          : 'Something went wrong talking to Firebase.'}
      </p>
      <p className="break-all rounded-xl bg-surface-variant px-3 py-2 font-mono text-xs text-ink-variant">
        {code ? `${code}: ` : ''}
        {error.message}
      </p>
      <button type="button" className="btn-filled" onClick={() => location.reload()}>
        Try again
      </button>
      <button type="button" className="btn-outlined" onClick={() => store.signOut()}>
        Sign out
      </button>
    </div>
  );
}

function SignedIn({ store, user }: { store: Store; user: SignedInUser }) {
  const [household, setHousehold] = useState<Household | null | typeof LOADING>(LOADING);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => store.onHousehold(user.uid, setHousehold, setError), [store, user.uid]);

  const hid = household && household !== LOADING ? household.id : null;
  useEffect(() => {
    if (!hid) return;
    const unsub = store.onTasks(hid, user.uid, setTasks, setError);
    return () => {
      unsub();
      setTasks(null);
    };
  }, [store, hid, user.uid]);

  if (error) return <Narrow><ErrorScreen error={error} store={store} /></Narrow>;
  if (household === LOADING) return <Spinner />;
  if (!household) return <Narrow><HouseholdSetup store={store} user={user} /></Narrow>;
  if (!tasks) return <Spinner />;
  return (
    <PrioritiesProvider store={store} user={user} household={household} tasks={tasks}>
      <Home />
    </PrioritiesProvider>
  );
}

export default function App({ store }: { store: Store }) {
  const [user, setUser] = useState<SignedInUser | null | typeof LOADING>(LOADING);
  const { needsRefresh, installUpdate } = usePWAUpdate();

  useEffect(() => store.onAuth(setUser), [store]);

  return (
    <div className="fixed inset-0 flex flex-col bg-bg text-ink">
      {needsRefresh && (
        <div className="flex items-center justify-between bg-accent-container px-4 py-2.5">
          <span className="text-sm font-medium text-on-accent-container">Update available</span>
          <button
            type="button"
            onClick={installUpdate}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white"
          >
            Install
          </button>
        </div>
      )}
      {user === LOADING ? (
        <Spinner />
      ) : user ? (
        <SignedIn store={store} user={user} />
      ) : (
        <Narrow>
          <LoginScreen store={store} />
        </Narrow>
      )}
    </div>
  );
}
