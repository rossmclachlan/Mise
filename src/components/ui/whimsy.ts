// The Look setting: how playful both apps look on this phone. Mise and
// Priorities share an origin, so one saved choice covers both. Each app's
// index.html applies it before first paint, with the same key.

export type Whimsy = 'calm' | 'sunny' | 'wild';

export const WHIMSY_KEY = 'homegrown:look';

export function getWhimsy(): Whimsy {
  try {
    const v = localStorage.getItem(WHIMSY_KEY);
    if (v === 'calm' || v === 'sunny') return v;
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return 'wild';
}

/** Saves the choice and applies it. Wild is the default, so it clears the attribute. */
export function setWhimsy(v: Whimsy) {
  try {
    localStorage.setItem(WHIMSY_KEY, v);
  } catch {
    // Still applied for this visit.
  }
  if (v === 'wild') delete document.documentElement.dataset.whimsy;
  else document.documentElement.dataset.whimsy = v;
}
