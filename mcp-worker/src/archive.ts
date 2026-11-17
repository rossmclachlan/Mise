// Keeps done_recent current, so the apps and the connector can load open and
// recently finished tasks instead of every task ever done (see
// priorities/src/lib/archive.ts for why).

import { stillRecent } from "../../priorities/src/lib/archive";
import type { DateString, Household, Task } from "../../priorities/src/types";
import type { Firestore, Write } from "./firestore";

async function commitAll(db: Firestore, writes: Write[]) {
	// Firestore takes at most 500 writes per commit.
	for (let i = 0; i < writes.length; i += 400) await db.commit(writes.slice(i, i + 400));
}

/**
 * Once per household: tags finished tasks that are still recent, then marks the
 * household ready, which switches the apps to loading only open and recent tasks.
 * Reads every task once.
 */
export async function tagRecentDone(db: Firestore, h: Household, today: DateString, at: string): Promise<number> {
	const path = `households/${h.id}/tasks`;
	const writes: Write[] = [];
	for (const doc of await db.query<Omit<Task, "id">>(path, [])) {
		const task = { ...doc.data, id: doc.id } as Task;
		const recent = stillRecent(task, today);
		if ((task.done_recent ?? false) !== recent) writes.push({ kind: "update", path: `${path}/${doc.id}`, data: { done_recent: recent } });
	}
	writes.push({ kind: "update", path: `households/${h.id}`, data: { done_recent_ready: at } });
	await commitAll(db, writes);
	return writes.length - 1;
}

/** Daily: untags finished tasks that are no longer recent. Reads only the tagged ones. */
export async function untagOldDone(db: Firestore, h: Household, today: DateString): Promise<number> {
	const path = `households/${h.id}/tasks`;
	const writes: Write[] = [];
	for (const doc of await db.query<Omit<Task, "id">>(path, [["done_recent", "EQUAL", true]])) {
		const task = { ...doc.data, id: doc.id } as Task;
		if (!stillRecent(task, today)) writes.push({ kind: "update", path: `${path}/${doc.id}`, data: { done_recent: false } });
	}
	await commitAll(db, writes);
	return writes.length;
}
