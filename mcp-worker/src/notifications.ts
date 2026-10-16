// Sends Priorities' notifications, every few minutes from the cron trigger:
// task reminders that have come due, and each person's morning digest.

import { localTime } from "../../priorities/src/lib/dates";
import { DIGEST_HOUR, digestFor, reminderFor, reminderRecipients, type PushMessage } from "../../priorities/src/lib/notify";
import type { Household, NotifyResult, Task } from "../../priorities/src/types";
import type { Firestore, Write } from "./firestore";
import { generateVapidKeys, sendPush, type PushResult, type VapidKeys } from "./webpush";

/** Who the pushes are from, for the push services (VAPID "sub"). */
const SUBJECT = "https://rossmclachlan.github.io/Mise/priorities/";

/** A digest that missed its hour (the cron skipped a beat) still goes out within this many hours. */
const DIGEST_GRACE_HOURS = 3;

const KV_KEY = "push:vapid";

/** The Worker's VAPID keys, made on first use and kept in KV (never in Firestore, which the apps can read). */
export async function vapidKeys(kv: KVNamespace): Promise<VapidKeys> {
	const stored = await kv.get<VapidKeys>(KV_KEY, "json");
	if (stored) return stored;
	const keys = await generateVapidKeys();
	await kv.put(KV_KEY, JSON.stringify(keys));
	return keys;
}

export interface NotifyDeps {
	db: Firestore;
	keys: VapidKeys;
	now: Date;
	fetcher?: typeof fetch;
}

export async function runNotifications(deps: NotifyDeps): Promise<void> {
	const households = await deps.db.query<Omit<Household, "id">>("households", []);
	for (const doc of households) {
		const h = { ...doc.data, id: doc.id } as Household;
		try {
			await notifyHousehold(deps, h);
		} catch (e) {
			console.log(JSON.stringify({ event: "notify_failed", household: h.id, error: String(e) }));
		}
	}
}

export async function notifyHousehold({ db, keys, now, fetcher }: NotifyDeps, h: Household): Promise<void> {
	const nowIso = now.toISOString();
	const local = localTime(now);
	const tasksPath = `households/${h.id}/tasks`;
	const subs = h.push_subscriptions ?? {};
	const gone = new Set<string>();
	const sent: string[] = [];
	// Fields written back to the household doc; a path in mask left out of data is deleted.
	const household: Record<string, unknown> = {};
	const mask: string[] = [];

	/** Sends to each of the person's phones, and notes how it went (shown in the app's Notifications menu). */
	async function send(uid: string, msg: PushMessage, what: NotifyResult["what"]) {
		const result: NotifyResult = { at: nowIso, what, sent: 0, gone: 0, failed: 0 };
		for (const [id, sub] of Object.entries(subs)) {
			if (sub.uid !== uid || gone.has(id)) continue;
			let r: PushResult;
			try {
				r = await sendPush(sub, JSON.stringify(msg), keys, SUBJECT, fetcher);
			} catch (e) {
				console.log(JSON.stringify({ event: "push_failed", error: String(e) }));
				r = { failed: 0 };
			}
			if (r === "gone") {
				gone.add(id);
				result.gone++;
			} else if (r === "sent") {
				sent.push(`${msg.tag}:${id}`);
				result.sent++;
			} else {
				result.failed++;
				result.error = r.failed ? String(r.failed) : "network";
			}
		}
		household.notify_last = { ...(household.notify_last as object), [uid]: result };
		if (!mask.includes(`notify_last.${uid}`)) mask.push(`notify_last.${uid}`);
	}

	// Test notifications asked for from the app's menu.
	for (const uid of Object.keys(h.push_test ?? {})) {
		if (h.members.includes(uid)) {
			await send(uid, { title: "Test from Priorities", body: "Notifications reach this phone.", url: "./", tag: "test" }, "test");
		}
		mask.push(`push_test.${uid}`);
	}

	const writes: Write[] = [];

	// Reminders that have come due. Each is sent once, then cleared; reminded_at
	// keeps its time so a repeating task's next occurrence can reuse it.
	const due = await db.query<Omit<Task, "id">>(tasksPath, [["remind_at", "LESS_THAN_OR_EQUAL", nowIso]]);
	for (const d of due) {
		const task = { ...d.data, id: d.id } as Task;
		if (!task.done_at) {
			const setter = [...task.history].reverse().find((e) => e.what.includes("set a reminder"))?.uid ?? task.created_by.uid;
			for (const uid of reminderRecipients(task, setter)) await send(uid, reminderFor(task), "reminder");
		}
		writes.push({ kind: "update", path: `${tasksPath}/${task.id}`, data: { remind_at: null, reminded_at: task.remind_at } });
	}

	// Morning digests, once a day each, at the hour each person picked.
	let tasks: Task[] | null = null;
	for (const uid of h.members) {
		const pref = h.notify?.[uid]?.digest_hour;
		const hour = pref === undefined ? DIGEST_HOUR : pref;
		if (hour === null || h.digest_sent?.[uid] === local.date) continue;
		if (local.hour < hour || local.hour >= hour + DIGEST_GRACE_HOURS) continue;
		if (!Object.values(subs).some((s) => s.uid === uid)) continue;
		tasks ??= (await db.query<Omit<Task, "id">>(tasksPath, [])).map((t) => ({ ...t.data, id: t.id }) as Task);
		const msg = digestFor(tasks, uid, local.date);
		if (msg) await send(uid, msg, "digest");
		household.digest_sent = { ...(household.digest_sent as object), [uid]: local.date };
		mask.push(`digest_sent.${uid}`);
	}

	if (h.push_public_key !== keys.publicKey) {
		household.push_public_key = keys.publicKey;
		mask.push("push_public_key");
	}
	// Leaving a gone subscription out of data while naming it in the mask deletes it.
	for (const id of gone) mask.push(`push_subscriptions.${id}`);
	if (mask.length) writes.push({ kind: "update", path: `households/${h.id}`, data: household, mask });

	if (writes.length) await db.commit(writes);
	if (sent.length || gone.size || due.length || mask.some((m) => m.startsWith("notify_last."))) {
		console.log(JSON.stringify({ event: "notified", household: h.id, sent, gone: [...gone], reminders: due.length }));
	}
}
