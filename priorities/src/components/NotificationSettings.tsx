import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { formatClock } from '../lib/dates';
import { DIGEST_HOUR, DIGEST_HOURS } from '../lib/notify';
import { currentSubscription, pushSupport, resubscribeIfDropped, subscribe, subscriptionId, unsubscribe } from '../data/push';
import { usePriorities } from '../state/PrioritiesContext';

/**
 * Rendered once while signed in: if this phone turned notifications on and has
 * since dropped off the list, quietly puts it back.
 */
export function KeepNotificationsOn() {
  const { user, household, store } = usePriorities();
  const key = household.push_public_key;
  const subs = household.push_subscriptions;
  // Re-checks when the list changes, e.g. the Worker forgot this phone while the app was open.
  const listed = Object.keys(subs ?? {}).sort().join(',');

  useEffect(() => {
    if (!key) return;
    resubscribeIfDropped(key, user.uid, subs ?? {})
      .then((r) => r && store.setPushSubscription(household.id, r.id, r.record))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, listed, user.uid, household.id, store]);

  return null;
}

/** Notifications, in the account menu: turn them on for this phone, and pick the morning digest's time. */
export function NotificationSettings() {
  const { user, household, store } = usePriorities();
  const support = pushSupport();
  // This phone's subscription id, once known; null = not subscribed here.
  const [thisId, setThisId] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    currentSubscription()
      .then(async (sub) => (sub ? subscriptionId(sub.endpoint) : null))
      .then((id) => live && setThisId(id))
      .catch(() => live && setThisId(null));
    return () => {
      live = false;
    };
  }, []);

  const subs = household.push_subscriptions ?? {};
  const onHere = !!thisId && subs[thisId]?.uid === user.uid;
  const anyOfMine = Object.values(subs).some((s) => s.uid === user.uid);
  const prefs = household.notify?.[user.uid] ?? {};
  const digestHour = prefs.digest_hour === undefined ? DIGEST_HOUR : prefs.digest_hour;

  async function turnOn() {
    if (!household.push_public_key) return;
    setBusy(true);
    setProblem(null);
    try {
      const { id, record } = await subscribe(household.push_public_key, user.uid);
      await store.setPushSubscription(household.id, id, record);
      setThisId(id);
    } catch (e) {
      setProblem(
        (e as Error).message === 'denied' || Notification.permission === 'denied'
          ? 'Notifications are blocked for Priorities. Allow them in your phone’s settings, then try again.'
          : 'Couldn’t turn notifications on. Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const id = (await unsubscribe()) ?? thisId;
      if (id) await store.setPushSubscription(household.id, id, null);
      setThisId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-ink-variant">Notifications</span>
      {support === 'needs-install' ? (
        <p className="text-sm text-ink">
          On iPhone, add Priorities to your Home Screen first (Share, then Add to Home Screen), then open it from there to
          turn notifications on.
        </p>
      ) : support === 'unsupported' ? (
        <p className="text-sm text-ink-variant">This browser can’t show notifications.</p>
      ) : onHere ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-variant px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Bell size={18} /> On for this phone
          </span>
          <button type="button" onClick={turnOff} disabled={busy} className="btn-outlined px-3 py-1.5 text-sm">
            <BellOff size={16} /> Turn off
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={turnOn}
          disabled={busy || thisId === undefined || !household.push_public_key}
          className="btn-tonal w-full"
        >
          <Bell size={18} /> {household.push_public_key ? 'Turn on notifications' : 'Notifications are being set up…'}
        </button>
      )}
      {problem && <p className="text-xs text-error">{problem}</p>}

      {(onHere || anyOfMine) && (
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink">Morning digest</span>
          <select
            value={digestHour ?? 'off'}
            onChange={(e) =>
              store.setNotifyPrefs(household.id, user.uid, {
                ...prefs,
                digest_hour: e.target.value === 'off' ? null : Number(e.target.value),
              })
            }
            className="input-field py-1.5 text-sm"
          >
            {DIGEST_HOURS.map((h) => (
              <option key={h} value={h}>
                {formatClock(h)}
              </option>
            ))}
            <option value="off">Off</option>
          </select>
        </label>
      )}
      <span className="text-xs text-ink-variant">
        The digest lists what’s on you this week. For a reminder about one task, open it and set Remind me.
      </span>
    </div>
  );
}
