import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** A strip shown while the phone is offline: changes are kept and sync later. Shared by both apps. */
export function OfflineNote() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  if (online) return null;
  return (
    <div role="status" className="shrink-0 bg-surface-variant px-4 py-1.5 text-center text-xs font-semibold text-ink-variant">
      Offline. Changes will sync when you’re back online.
    </div>
  );
}
