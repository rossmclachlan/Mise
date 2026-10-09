// Runs against the Firestore emulator: npm run test:emulator
// (firebase emulators:exec starts it and sets FIRESTORE_EMULATOR_HOST).
import { beforeEach, describe, expect, it } from "vitest";
import { Firestore } from "../src/firestore";
import { NotFound, PrioritiesData } from "../src/tasks";

const host = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = "demo-priorities";
const db = new Firestore({ projectId: PROJECT, emulatorHost: host });
const NOW = "2026-10-07"; // a Wednesday
const AT = "2026-10-07T18:00:00.000Z";
const H = "house1";

const as = (uid: string) => new PrioritiesData(db, uid, NOW, AT);

async function reset() {
	await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
	await db.commit([
		{
			kind: "create",
			path: `households/${H}`,
			data: { name: "Ours", members: ["ross", "emily"], member_names: { ross: "Ross", emily: "Emily" } },
		},
	]);
	const emily = as("emily");
	await emily.add([{ title: "Emily's secret", list: "personal" }]);
	await as("ross").add([
		{ title: "Ross's own thing", list: "personal", do_by: "2026-10-08" },
		{ title: "Call plumber", list: "shared", owner: "me", do_by: "2026-10-06" },
		{ title: "Book dentist", list: "shared", do_by: "2026-10-20" },
	]);
}

describe.skipIf(!host)("PrioritiesData against the Firestore emulator", () => {
	beforeEach(reset);

	it("never shows the other person's personal list", async () => {
		const ross = as("ross");
		const titles = (await ross.visibleTasks()).map((t) => t.title).sort();
		expect(titles).toEqual(["Book dentist", "Call plumber", "Ross's own thing"]);
		const secret = (await as("emily").visibleTasks()).find((t) => t.title === "Emily's secret")!;
		await expect(ross.getTask(secret.id)).rejects.toBeInstanceOf(NotFound);
		await expect(ross.update(secret.id, { title: "x" })).rejects.toBeInstanceOf(NotFound);
		await expect(ross.remove(secret.id)).rejects.toBeInstanceOf(NotFound);
		expect((await ross.search("secret", true)).length).toBe(0);
	});

	it("adds tasks with owners, steps, notes and a repeat", async () => {
		const ross = as("ross");
		const [t] = await ross.add([
			{
				title: "Renew passports",
				list: "shared",
				owner: "both",
				deadline: "2026-12-15",
				steps: [
					{ title: "Get photos", do_by: "2026-10-09", owner: "me" },
					{ title: "Fill in forms", owner: "partner" },
				],
				note: "From the State Dept email",
			},
		]);
		expect(t.owner).toBe("Ross & Emily");
		expect(t.horizon).toBe("now"); // earliest open step is this week
		expect(t.steps!.items.map((s) => s.owner)).toEqual(["Ross", "Emily"]);
		expect(t.notes![0].by).toBe("Ross via Claude");
		await expect(ross.add([{ title: "x", list: "personal", owner: "partner" }])).rejects.toThrow(/own list/);
		const [r] = await ross.add([{ title: "Change filter", list: "shared", repeat: { every: 3, unit: "month", mode: "after_done" } }]);
		expect(r.do_by).toBe(NOW); // a repeat gets a date to count from
		expect(r.repeat).toBe("every 3 months after done");
	});

	it("lists by horizon and owner, with Now in manual order", async () => {
		const ross = as("ross");
		const now = await ross.list({ horizon: "now" });
		expect(now.map((t) => t.title).sort()).toEqual(["Call plumber", "Ross's own thing"]);
		expect(now.find((t) => t.title === "Call plumber")!.overdue).toBe(true);
		expect((await ross.list({ horizon: "month" })).map((t) => t.title)).toEqual(["Book dentist"]);
		expect((await ross.list({ owner: "unclaimed" })).map((t) => t.title)).toEqual(["Book dentist"]);
		const ids = now.map((t) => t.id).reverse();
		await ross.reorderNow(ids);
		expect((await ross.list({ horizon: "now" })).map((t) => t.id)).toEqual(ids);
	});

	it("completes with an outcome, keeps it under Taken care of, and repeats", async () => {
		const ross = as("ross");
		const [t] = await ross.add([
			{ title: "Book kids' checkups", list: "shared", owner: "me", do_by: "2026-10-09", repeat: { every: 1, unit: "year", mode: "schedule" } },
		]);
		const res = await ross.complete(t.id, { outcome_note: "Dr. Alvarez, 3:30pm, #48213", when: "2026-10-20" });
		expect(res.done.status).toBe("taken care of (date still ahead)");
		expect(res.next_occurrence!.do_by).toBe("2027-10-09");
		const emily = as("emily");
		const tco = await emily.list({ horizon: "taken_care_of" });
		expect(tco.map((x) => x.outcome_note)).toEqual(["Dr. Alvarez, 3:30pm, #48213"]);
		expect((await emily.search("alvarez", true))[0].when).toBe("2026-10-20");
		const ov = await emily.overview();
		expect(ov.taken_care_of_next_4_weeks.map((x) => x.title)).toEqual(["Book kids' checkups"]);
		expect(ov.done_this_week).toContain("Book kids' checkups");
		await expect(ross.complete(t.id, {})).rejects.toThrow(/already done/);
		const reopened = await ross.reopen(t.id);
		expect(reopened.status).toBe("open");
	});

	it("updates steps, owners and dates, and defers", async () => {
		const ross = as("ross");
		const dentist = (await ross.list({})).find((t) => t.title === "Book dentist")!;
		const u = await ross.update(dentist.id, { owner: "partner", add_steps: [{ title: "Call office" }], deadline: "2026-11-01" });
		expect(u.owner).toBe("Emily");
		const stepId = u.steps!.items[0].id;
		const u2 = await ross.update(dentist.id, { update_steps: [{ id: stepId, done: true }] });
		expect(u2.steps!.progress).toBe("1 of 1");
		const plumber = (await ross.list({ horizon: "now" })).find((t) => t.title === "Call plumber")!;
		const [d] = await ross.defer([plumber.id], "month");
		expect(d.horizon).toBe("month");
		expect(d.do_by).toBe("2026-10-12");
		const own = (await ross.list({ list: "mine" })).find((t) => t.title === "Ross's own thing")!;
		await expect(ross.update(own.id, { owner: "partner" })).rejects.toThrow(/personal/);
		const moved = await ross.update(own.id, { list: "shared", owner: "partner" });
		expect(moved.owner).toBe("Emily");
		expect((await as("emily").visibleTasks()).some((t) => t.title === "Ross's own thing")).toBe(true);
	});

	it("skips a repeat without completing it", async () => {
		const ross = as("ross");
		const [t] = await ross.add([{ title: "Trash out", list: "shared", do_by: "2026-10-08", repeat: { every: 1, unit: "week", mode: "schedule" } }]);
		const s = await ross.skip(t.id);
		expect(s.do_by).toBe("2026-10-15");
		expect(s.status).toBe("open");
	});

	it("reads and edits the house rules", async () => {
		const ross = as("ross");
		expect((await ross.getHouseRules("DEFAULT")).text).toBe("DEFAULT");
		await ross.setHouseRules("Dentist stuff goes to Ross.");
		const rules = await as("emily").getHouseRules("DEFAULT");
		expect(rules.text).toBe("Dentist stuff goes to Ross.");
		expect(rules.updated).toMatch(/by Ross/);
		await ross.setHouseRules("v3");
		// Dentist rules, then v3, are kept as earlier versions.
		expect((await ross.setHouseRules("v4")).previous_versions_kept).toBe(2);
	});

	it("reports a missing household clearly", async () => {
		await expect(as("stranger").visibleTasks()).rejects.toThrow(/No Priorities household/);
	});
});
