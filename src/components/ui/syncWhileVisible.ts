import { disableNetwork, enableNetwork, type Firestore } from 'firebase/firestore';

/** Long enough that switching apps for a moment doesn't drop the connection. */
const HIDDEN_GRACE_MS = 60_000;

/**
 * Stops syncing while the app is out of sight, and picks up where it left off
 * when it's back. A phone can keep an app alive in the background for hours,
 * and each time its connection drops and comes back Firestore re-reads every
 * list, which once used up the project's free daily reads. Changes made while
 * hidden wait in the offline copy and go out on return.
 */
export function syncWhileVisible(db: Firestore) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paused = false;
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (document.visibilityState === 'hidden') {
      timer = setTimeout(() => {
        paused = true;
        disableNetwork(db).catch(() => {});
      }, HIDDEN_GRACE_MS);
    } else if (paused) {
      paused = false;
      enableNetwork(db).catch(() => {});
    }
  });
}
