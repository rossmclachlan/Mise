import { disableNetwork, enableNetwork, type Firestore } from 'firebase/firestore';

/** Switching apps for a moment keeps the connection. */
const HIDDEN_GRACE_MS = 10_000;
/** A screen left on with nobody using it (a laptop, a tablet on the counter) stops syncing after this. */
const IDLE_MS = 10 * 60_000;
const CHECK_MS = 60_000;

/**
 * Syncs only while someone is using the app, and picks up where it left off
 * when they're back. Each time a paused connection comes back after more than
 * 30 minutes, Firestore re-reads (and bills) every task and list in full. An
 * app left open in the background, or on a screen nobody is looking at that
 * sleeps and wakes through the night, can do that over and over and use up
 * the project's free daily reads. So it pauses:
 * - 10 seconds after the app is hidden, or straight away when the page is
 *   frozen or put away (phones do this to background apps);
 * - after 10 minutes on screen with no taps, clicks, scrolling or typing.
 * Any of those, or showing the app again, turns syncing back on. Changes made
 * while paused wait in the offline copy and go out on return. Pausing and
 * resuming within 30 minutes costs only the changes in between.
 */
export function syncWhileInUse(db: Firestore) {
  let paused = false;
  let lastUse = Date.now();
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined;

  const pause = () => {
    clearTimeout(hiddenTimer);
    if (paused) return;
    paused = true;
    disableNetwork(db).catch(() => {});
  };
  const resume = () => {
    lastUse = Date.now();
    clearTimeout(hiddenTimer);
    if (!paused || document.visibilityState !== 'visible') return;
    paused = false;
    enableNetwork(db).catch(() => {});
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clearTimeout(hiddenTimer);
      hiddenTimer = setTimeout(pause, HIDDEN_GRACE_MS);
    } else {
      resume();
    }
  });
  // Chrome's page lifecycle: frozen pages and pages being put away get no more timers.
  document.addEventListener('freeze', pause);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  window.addEventListener('focus', resume);

  const used = () => {
    lastUse = Date.now();
    if (paused) resume();
  };
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
    window.addEventListener(type, used, { passive: true, capture: true });
  }

  // Timers stop while a device sleeps, so this compares clock times: on waking
  // after a long sleep it pauses at once.
  setInterval(() => {
    if (!paused && Date.now() - lastUse >= IDLE_MS) pause();
  }, CHECK_MS);
}
