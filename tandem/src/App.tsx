import { useEffect, useState } from 'react';
import type { Household, Task } from './types';
import type { SignedInUser, Store } from './data/store';
import { usePWAUpdate } from '../../src/hooks/usePWAUpdate';
import { TandemProvider } from './state/TandemContext';
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

function SignedIn({ store, user }: { store: Store; user: SignedInUser }) {
  const [household, setHousehold] = useState<Household | null | typeof LOADING>(LOADING);
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => store.onHousehold(user.uid, setHousehold), [store, user.uid]);

  const hid = household && household !== LOADING ? household.id : null;
  useEffect(() => {
    if (!hid) return;
    const unsub = store.onTasks(hid, user.uid, setTasks);
    return () => {
      unsub();
      setTasks(null);
    };
  }, [store, hid, user.uid]);

  if (household === LOADING) return <Spinner />;
  if (!household) return <HouseholdSetup store={store} user={user} />;
  if (!tasks) return <Spinner />;
  return (
    <TandemProvider store={store} user={user} household={household} tasks={tasks}>
      <Home />
    </TandemProvider>
  );
}

export default function App({ store }: { store: Store }) {
  const [user, setUser] = useState<SignedInUser | null | typeof LOADING>(LOADING);
  const { needsRefresh, installUpdate } = usePWAUpdate();

  useEffect(() => store.onAuth(setUser), [store]);

  return (
    <div className="fixed inset-0 mx-auto flex max-w-[480px] flex-col bg-bg text-ink">
      {user === LOADING ? (
        <Spinner />
      ) : user ? (
        <SignedIn store={store} user={user} />
      ) : (
        <LoginScreen store={store} />
      )}
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
    </div>
  );
}
