import type { PushSubscriptionRecord } from '../types';

// This phone's side of notifications: asking permission and subscribing with
// the Worker's public key. The Worker does the sending.

export type PushSupport = 'ok' | 'needs-install' | 'unsupported';

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function pushSupport(): PushSupport {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  // iPhones only offer push to apps added to the Home Screen.
  return isIos() ? 'needs-install' : 'unsupported';
}

export function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || isIos()) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Browser';
}

/** A short, stable id for a subscription, so the same phone never appears twice. */
export async function subscriptionId(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function toB64url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

// Whether notifications were turned on or off on this phone, from the menu.
const WANT_KEY = 'priorities-push';

function setWanted(on: boolean) {
  try {
    localStorage.setItem(WANT_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode: nothing to remember, so nothing gets re-subscribed.
  }
}

function wanted(): 'on' | 'off' | null {
  try {
    const v = localStorage.getItem(WANT_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Asks permission (must be called from a tap) and subscribes this phone.
 * quiet: re-subscribing in the background, so no "Notifications are on" message.
 */
export async function subscribe(
  publicKey: string,
  uid: string,
  { quiet = false }: { quiet?: boolean } = {},
): Promise<{ id: string; record: PushSubscriptionRecord }> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an older key can't receive our pushes; start over.
  if (sub && toB64url(sub.options.applicationServerKey) !== publicKey) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(publicKey) });
  const record: PushSubscriptionRecord = {
    uid,
    endpoint: sub.endpoint,
    p256dh: toB64url(sub.getKey('p256dh')),
    auth: toB64url(sub.getKey('auth')),
    created_at: new Date().toISOString(),
    device: deviceName(),
  };
  setWanted(true);
  if (quiet) return { id: await subscriptionId(sub.endpoint), record };
  // Shows straight away that notifications work on this phone.
  await reg.showNotification('Notifications are on', {
    body: 'Priorities will let you know here.',
    icon: 'icon-192.png',
    tag: 'welcome',
  });
  return { id: await subscriptionId(sub.endpoint), record };
}

export async function unsubscribe(): Promise<string | null> {
  setWanted(false);
  const sub = await currentSubscription();
  if (!sub) return null;
  const id = await subscriptionId(sub.endpoint);
  await sub.unsubscribe();
  return id;
}

/**
 * Keeps notifications on for a phone that turned them on: the phone can drop
 * its subscription (and the Worker then forgets it), while the permission is
 * still granted. Re-subscribes without asking, and returns what to save, or
 * null when this phone is already on the list (or never turned them on).
 */
export async function resubscribeIfDropped(
  publicKey: string,
  uid: string,
  subs: Record<string, PushSubscriptionRecord>,
): Promise<{ id: string; record: PushSubscriptionRecord } | null> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return null;
  const want = wanted();
  if (want === 'off') return null;
  const existing = await currentSubscription();
  // Phones that turned notifications on before this was remembered count as on while subscribed.
  if (!want && !existing) return null;
  if (existing && toB64url(existing.options.applicationServerKey) === publicKey && subs[await subscriptionId(existing.endpoint)]) {
    return null;
  }
  const next = await subscribe(publicKey, uid, { quiet: true });
  return subs[next.id] ? null : next;
}
