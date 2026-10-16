// Runs against the Firestore emulator, like tasks.test.ts.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setTimeZone } from "../../priorities/src/lib/dates";
import type { Household, Task } from "../../priorities/src/types";
import { Firestore } from "../src/firestore";
import { notifyHousehold } from "../src/notifications";
import { PrioritiesData } from "../src/tasks";
import { generateVapidKeys, type VapidKeys } from "../src/webpush";

const host = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = "demo-priorities";
const db = new Firestore({ projectId: PROJECT, emulatorHost: host });
const H = "house1";
const sub = (uid: string, n: number) => ({
	uid,
	endpoint: `https://push.example/${uid}/${n}`,
	// A real P-256 point and auth secret, so encryption runs.
	p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
	auth: "tBHItJI5svbpez7KI4CCXg",
	created_at: "2026-10-01T00:00:00Z",
	device: "Android",
});

let keys: VapidKeys;
let pushes: { to: string; msg: string }[];
let goneEndpoints: Set<string>;
const fetcher = (async (url: string) => {
	pushes.push({ to: url, msg: "" });
	return new Response("", { status: goneEndpoints.has(url) ? 410 : 201 });
}) as unknown as typeof fetch;

async function household(): Promise<Household> {
	const d = await db.get<Omit<Household, "id">>(`households/${H}`);
	return { ...d!.data, id: H } as Household;
}

const run = async (at: string) =>
	notifyHousehold({ db, keys, now: new Date(at), fetcher }, await household());

async function reset() {
	await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
	await db.commit([
		{
			kind: "create",
			path: `households/${H}`,
			data: {
				name: "Ours",
				members: ["ross", "emily"],
				member_names: { ross: "Ross", emily: "Emily" },
				push_subscriptions: { r1: sub("ross", 1), e1: sub("emily", 1), e2: sub("emily", 2) },
			},
		},
	]);
	pushes = [];
	goneEndpoints = new Set();
}

describe.skipIf(!host)("notifications against the Firestore emulator", () => {
	beforeAll(async () => {
		setTimeZone("America/Los_Angeles");
		keys = await generateVapidKeys();
	});
	beforeEach(reset);

	it("sends a reminder once it's due, to whoever's on the task, then clears it", async () => {
		const ross = new PrioritiesData(db, "ross", "2026-10-07", "2026-10-07T16:00:00.000Z");
		const [soon, later, secret] = await ross.add([
			{ title: "Call plumber", owner: "partner", remind_at: "2026-10-07T10:00" },
			{ title: "Book dentist", owner: "me", remind_at: "2026-10-08T10:00" },
			{ title: "Ross's secret", private: true, remind_at: "2026-10-07T10:00" },
		]);
		expect(soon.remind_at).toBe("2026-10-07 10:00");

		await run("2026-10-07T17:01:00Z"); // 10:01 Pacific
		expect(pushes.map((p) => p.to).sort()).toEqual([
			"https://push.example/emily/1",
			"https://push.example/emily/2",
			"https://push.example/ross/1",
		]);
		const get = async (id: string) => (await db.get<Task>(`households/${H}/tasks/${id}`))!.data;
		expect((await get(soon.id)).remind_at).toBeNull();
		expect((await get(soon.id)).reminded_at).toBe("2026-10-07T17:00:00.000Z");
		expect((await get(secret.id)).remind_at).toBeNull();
		expect((await get(later.id)).remind_at).toBe("2026-10-08T17:00:00.000Z");

		pushes = [];
		await run("2026-10-07T17:06:00Z");
		expect(pushes).toEqual([]);
	});

	it("sends each person's digest once, at their hour", async () => {
		const ross = new PrioritiesData(db, "ross", "2026-10-07", "2026-10-07T13:00:00.000Z");
		await ross.add([{ title: "Call plumber", owner: "me", due: "2026-10-06" }]);
		await db.commit([{ kind: "update", path: `households/${H}`, data: { notify: { emily: { digest_hour: null } } } }]);

		await run("2026-10-07T13:30:00Z"); // 6:30 Pacific: too early
		expect(pushes).toEqual([]);

		await run("2026-10-07T14:02:00Z"); // 7:02
		expect(pushes.map((p) => p.to)).toEqual(["https://push.example/ross/1"]);
		expect((await household()).digest_sent).toEqual({ ross: "2026-10-07" });

		pushes = [];
		await run("2026-10-07T14:07:00Z");
		expect(pushes).toEqual([]);
	});

	it("publishes its public key and forgets phones that unsubscribed", async () => {
		const ross = new PrioritiesData(db, "ross", "2026-10-07", "2026-10-07T16:00:00.000Z");
		await ross.add([{ title: "Call plumber", owner: "partner", remind_at: "2026-10-07T10:00" }]);
		goneEndpoints.add("https://push.example/emily/2");
		await run("2026-10-07T17:01:00Z");
		const h = await household();
		expect(h.push_public_key).toBe(keys.publicKey);
		expect(Object.keys(h.push_subscriptions!).sort()).toEqual(["e1", "r1"]);
		expect(h.notify_last?.emily).toMatchObject({ what: "reminder", sent: 1, gone: 1, failed: 0 });
	});

	it("sends a test someone asked for, notes how it went, and clears the request", async () => {
		await db.commit([{ kind: "update", path: `households/${H}`, data: { push_test: { emily: "2026-10-07T17:00:00Z" } } }]);
		await run("2026-10-07T17:01:00Z");
		expect(pushes.map((p) => p.to).sort()).toEqual(["https://push.example/emily/1", "https://push.example/emily/2"]);
		const h = await household();
		expect(h.push_test).toEqual({});
		expect(h.notify_last).toEqual({
			emily: { at: "2026-10-07T17:01:00.000Z", what: "test", sent: 2, gone: 0, failed: 0 },
		});
	});
});
