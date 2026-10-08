// What the MCP tools do, on top of the same logic the Tandem app uses
// (../../tandem/src/lib), so a task Claude adds or ticks behaves exactly like
// one added or ticked in the app.
//
// The Worker reads Firestore as a service account, which bypasses security
// rules, so visibility is enforced here: a person sees the shared list and
// their own personal list, never the other person's.

import { addDays, localDay, weekEnd } from "../../tandem/src/lib/dates";
import {
	MONTH_DAYS,
	effectiveDate,
	effectiveHorizon,
	isComingUp,
	isDoneThisWeek,
	isOverdue,
	moveToHorizon,
} from "../../tandem/src/lib/horizon";
import {
	buildTask,
	compareOpen,
	completeTask,
	historyEntry,
	newId,
	reopenTask,
	skipOccurrence,
	stepProgress,
	type Actor,
} from "../../tandem/src/lib/ops";
import { describeRepeat } from "../../tandem/src/lib/repeat";
import { canSee, isOnMe } from "../../tandem/src/lib/visibility";
import type { DateString, Household, Horizon, RepeatRule, Step, Task } from "../../tandem/src/types";
import type { Doc, Firestore, Write } from "./firestore";

export type OwnerWord = "me" | "partner" | "both" | "unclaimed";
export type ListWord = "mine" | "shared" | "all";
export type HorizonWord = Horizon | "taken_care_of" | "done";

export interface StepInput {
	title: string;
	do_by?: DateString | null;
	owner?: "me" | "partner" | "unclaimed";
}

export interface NewTask {
	title: string;
	list: "shared" | "personal";
	owner?: OwnerWord;
	horizon?: Horizon;
	do_by?: DateString | null;
	deadline?: DateString | null;
	repeat?: RepeatRule | null;
	steps?: StepInput[];
	note?: string;
	source_url?: string | null;
}

export interface TaskChanges {
	title?: string;
	list?: "shared" | "personal";
	owner?: OwnerWord;
	do_by?: DateString | null;
	deadline?: DateString | null;
	repeat?: RepeatRule | null;
	source_url?: string | null;
	add_steps?: StepInput[];
	update_steps?: { id: string; title?: string; done?: boolean; do_by?: DateString | null; owner?: StepInput["owner"] }[];
	remove_step_ids?: string[];
	/** Done tasks only: what happened, and the date it is about. */
	outcome_note?: string | null;
	when?: DateString | null;
}

export class NotFound extends Error {}

export class TandemData {
	private household?: Household | null;

	constructor(
		private readonly db: Firestore,
		private readonly uid: string,
		private readonly now: DateString,
		private readonly at: string,
	) {}

	private get actor(): Actor {
		return { uid: this.uid, via: "mcp" };
	}

	// ── Loading ──────────────────────────────────────────────────────────────

	async getHousehold(): Promise<Household> {
		if (this.household === undefined) {
			const [doc] = await this.db.query<Omit<Household, "id">>("households", [["members", "ARRAY_CONTAINS", this.uid]], 1);
			this.household = doc ? { ...doc.data, id: doc.id } : null;
		}
		if (!this.household) {
			throw new Error("No Tandem household yet. Open the Tandem app and start or join one first.");
		}
		return this.household;
	}

	private tasksPath(hid: string) {
		return `households/${hid}/tasks`;
	}

	/** Shared tasks plus this person's personal tasks. */
	async visibleTasks(): Promise<Task[]> {
		const h = await this.getHousehold();
		const [shared, personal] = await Promise.all([
			this.db.query<Omit<Task, "id">>(this.tasksPath(h.id), [["list", "EQUAL", "shared"]]),
			this.db.query<Omit<Task, "id">>(this.tasksPath(h.id), [
				["list", "EQUAL", "personal"],
				["owner_uid", "EQUAL", this.uid],
			]),
		]);
		return [...shared, ...personal].map(asTask);
	}

	async getTask(id: string): Promise<Task> {
		const h = await this.getHousehold();
		const doc = await this.db.get<Omit<Task, "id">>(`${this.tasksPath(h.id)}/${id}`);
		const task = doc ? asTask(doc) : null;
		// A task on the other person's personal list is reported as missing, not forbidden.
		if (!task || !canSee(task, this.uid)) throw new NotFound(`No task with id ${id}`);
		return task;
	}

	// ── People ───────────────────────────────────────────────────────────────

	private async partnerUid(): Promise<string | null> {
		const h = await this.getHousehold();
		return h.members.find((m) => m !== this.uid) ?? null;
	}

	private async assigneeFor(owner: OwnerWord): Promise<string[]> {
		const partner = await this.partnerUid();
		switch (owner) {
			case "me":
				return [this.uid];
			case "partner":
				if (!partner) throw new Error("Nobody else has joined the household yet");
				return [partner];
			case "both":
				return partner ? [this.uid, partner] : [this.uid];
			case "unclaimed":
				return [];
		}
	}

	private async stepOwner(owner: StepInput["owner"]): Promise<string | null> {
		if (!owner || owner === "unclaimed") return null;
		return owner === "me" ? this.uid : await this.partnerUid();
	}

	async names(): Promise<Record<string, string>> {
		return (await this.getHousehold()).member_names;
	}

	// ── Describing tasks for Claude ──────────────────────────────────────────

	async describe(task: Task) {
		const names = await this.names();
		const name = (uid: string | null | undefined) => (uid ? (names[uid] ?? "someone") : null);
		const done = task.done_at !== null;
		const steps = stepProgress(task);
		return {
			id: task.id,
			title: task.title,
			list: task.list,
			owner:
				task.list === "personal"
					? name(task.owner_uid)
					: task.assignee.length === 0
						? "unclaimed"
						: task.assignee.map((u) => name(u)).join(" & "),
			status: done ? (isComingUp(task, this.now) ? "taken care of (date still ahead)" : "done") : "open",
			horizon: done ? undefined : effectiveHorizon(task, this.now),
			overdue: isOverdue(task, this.now) || undefined,
			do_by: task.do_by ?? undefined,
			deadline: task.deadline ?? undefined,
			repeat: task.repeat ? describeRepeat(task.repeat, task.do_by ?? task.deadline) : undefined,
			steps: task.steps.length
				? {
						progress: `${steps.done} of ${steps.total}`,
						items: task.steps.map((s) => ({
							id: s.id,
							title: s.title,
							done: s.done_at !== null,
							owner: name(s.assignee) ?? undefined,
							do_by: s.do_by ?? undefined,
						})),
					}
				: undefined,
			notes: task.notes.length
				? task.notes.map((n) => ({ by: `${name(n.uid)}${n.via === "mcp" ? " via Claude" : ""}`, on: localDay(n.at), text: n.text }))
				: undefined,
			source_url: task.source_url ?? undefined,
			done_on: done ? localDay(task.done_at!) : undefined,
			done_by: done ? (name(task.done_by) ?? undefined) : undefined,
			outcome_note: task.outcome_note ?? undefined,
			when: task.when ?? undefined,
			added: `${localDay(task.created_at)} by ${name(task.created_by.uid)}${task.created_by.via === "mcp" ? " via Claude" : ""}`,
		};
	}

	// ── Reading ──────────────────────────────────────────────────────────────

	async list(opts: { list?: ListWord; horizon?: HorizonWord; owner?: OwnerWord; done_since?: DateString }) {
		const partner = await this.partnerUid();
		let tasks = await this.visibleTasks();
		const list = opts.list ?? "all";
		if (list === "mine") tasks = tasks.filter((t) => isOnMe(t, this.uid));
		if (list === "shared") tasks = tasks.filter((t) => t.list === "shared");
		if (opts.owner) {
			const want = (t: Task) => {
				if (t.list === "personal") return opts.owner === "me";
				switch (opts.owner) {
					case "me":
						return t.assignee.includes(this.uid);
					case "partner":
						return partner !== null && t.assignee.includes(partner);
					case "both":
						return partner !== null && t.assignee.includes(this.uid) && t.assignee.includes(partner);
					default:
						return t.assignee.length === 0;
				}
			};
			tasks = tasks.filter(want);
		}
		const h = opts.horizon;
		if (h === "taken_care_of") tasks = tasks.filter((t) => isComingUp(t, this.now));
		else if (h === "done") tasks = tasks.filter((t) => t.done_at && (!opts.done_since || localDay(t.done_at) >= opts.done_since));
		else if (opts.done_since) tasks = tasks.filter((t) => t.done_at && localDay(t.done_at) >= opts.done_since!);
		else {
			tasks = tasks.filter((t) => !t.done_at);
			if (h) tasks = tasks.filter((t) => effectiveHorizon(t, this.now) === h);
		}
		tasks.sort((a, b) =>
			!a.done_at && !b.done_at && effectiveHorizon(a, this.now) === "now" && effectiveHorizon(b, this.now) === "now"
				? a.rank - b.rank
				: compareOpen(a, b),
		);
		return Promise.all(tasks.map((t) => this.describe(t)));
	}

	async search(query: string, includeDone: boolean) {
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		const hay = (t: Task) =>
			[t.title, t.outcome_note ?? "", ...t.notes.map((n) => n.text), ...t.steps.map((s) => s.title)].join(" ").toLowerCase();
		const tasks = (await this.visibleTasks()).filter((t) => (includeDone || !t.done_at) && words.every((w) => hay(t).includes(w)));
		return Promise.all(tasks.map((t) => this.describe(t)));
	}

	async overview() {
		const h = await this.getHousehold();
		const tasks = await this.visibleTasks();
		const open = tasks.filter((t) => !t.done_at);
		const people = h.members.map((uid) => {
			const on = open.filter((t) => (t.list === "personal" ? t.owner_uid === uid : t.assignee.includes(uid)));
			const count = (hz: Horizon) => on.filter((t) => effectiveHorizon(t, this.now) === hz).length;
			return {
				name: h.member_names[uid],
				is_me: uid === this.uid,
				now: count("now"),
				this_month: count("month"),
				later: count("later"),
				now_titles: on
					.filter((t) => effectiveHorizon(t, this.now) === "now")
					.sort((a, b) => a.rank - b.rank)
					.map((t) => t.title),
			};
		});
		const monthEnd = addDays(this.now, MONTH_DAYS);
		return {
			today: this.now,
			week_ends: weekEnd(this.now),
			note: "Counts for the other person include only shared tasks; their personal list is private.",
			people,
			overdue: open.filter((t) => isOverdue(t, this.now)).map((t) => ({ id: t.id, title: t.title, was_due: effectiveDate(t) })),
			unclaimed_shared: open
				.filter((t) => t.list === "shared" && t.assignee.length === 0)
				.map((t) => ({ id: t.id, title: t.title, horizon: effectiveHorizon(t, this.now) })),
			taken_care_of_next_4_weeks: tasks
				.filter((t) => isComingUp(t, this.now) && t.when! <= monthEnd)
				.sort((a, b) => (a.when! < b.when! ? -1 : 1))
				.map((t) => ({ id: t.id, title: t.title, when: t.when, outcome_note: t.outcome_note })),
			done_this_week: tasks.filter((t) => isDoneThisWeek(t, this.now)).map((t) => t.title),
		};
	}

	// ── Writing ──────────────────────────────────────────────────────────────

	private async write(writes: Write[]) {
		await this.db.commit(writes);
	}

	private async taskPath(id: string) {
		return `${this.tasksPath((await this.getHousehold()).id)}/${id}`;
	}

	private async buildSteps(inputs: StepInput[] = []): Promise<Step[]> {
		return Promise.all(
			inputs.map(async (s) => ({
				id: newId(),
				title: s.title.trim(),
				done_at: null,
				assignee: await this.stepOwner(s.owner),
				do_by: s.do_by ?? null,
			})),
		);
	}

	async add(inputs: NewTask[]) {
		const writes: Write[] = [];
		const created: Task[] = [];
		for (const input of inputs) {
			if (input.list === "personal" && input.owner && input.owner !== "me") {
				throw new Error(`"${input.title}": a personal task can only go on your own list. Use the shared list to give it to someone else.`);
			}
			const task = buildTask(
				{
					title: input.title,
					list: input.list,
					assignee: input.list === "shared" ? await this.assigneeFor(input.owner ?? "unclaimed") : [],
					horizon: input.horizon,
					do_by: input.do_by,
					deadline: input.deadline,
					// A repeat needs a date to count from.
					repeat: input.repeat ?? null,
					source_url: input.source_url,
				},
				this.actor,
				this.at,
			);
			if (task.repeat && !task.do_by && !task.deadline) task.do_by = this.now;
			task.steps = await this.buildSteps(input.steps);
			if (input.note?.trim()) task.notes = [{ id: newId(), text: input.note.trim(), uid: this.uid, via: "mcp", at: this.at }];
			const { id, ...data } = task;
			writes.push({ kind: "create", path: await this.taskPath(id), data });
			created.push(task);
		}
		await this.write(writes);
		return Promise.all(created.map((t) => this.describe(t)));
	}

	async update(id: string, changes: TaskChanges) {
		const task = await this.getTask(id);
		const u: Partial<Task> = {};
		const what: string[] = [];
		if (changes.title !== undefined) {
			u.title = changes.title.trim();
			what.push("renamed");
		}
		if (changes.list && changes.list !== task.list) {
			Object.assign(u, changes.list === "personal" ? { list: "personal", owner_uid: this.uid, assignee: [] } : { list: "shared", owner_uid: null, assignee: [this.uid] });
			what.push(`moved to ${changes.list}`);
		}
		if (changes.owner) {
			if ((u.list ?? task.list) === "personal") {
				if (changes.owner !== "me") throw new Error("A personal task can only be yours. Move it to the shared list first (list: shared).");
			} else {
				u.assignee = await this.assigneeFor(changes.owner);
				what.push(`assigned to ${changes.owner}`);
			}
		}
		for (const k of ["do_by", "deadline", "source_url", "outcome_note", "when"] as const) {
			if (changes[k] !== undefined) {
				(u as Record<string, unknown>)[k] = changes[k];
				what.push(`changed ${k.replace("_", " ")}`);
			}
		}
		if (changes.repeat !== undefined) {
			u.repeat = changes.repeat;
			if (changes.repeat && !(u.do_by ?? task.do_by) && !(u.deadline ?? task.deadline)) u.do_by = this.now;
			what.push(changes.repeat ? `repeats ${describeRepeat(changes.repeat)}` : "stopped repeating");
		}
		if (changes.add_steps || changes.update_steps || changes.remove_step_ids) {
			let steps = task.steps.filter((s) => !changes.remove_step_ids?.includes(s.id));
			for (const su of changes.update_steps ?? []) {
				if (!steps.some((s) => s.id === su.id)) throw new Error(`No step with id ${su.id} on this task`);
				const owner = su.owner === undefined ? undefined : await this.stepOwner(su.owner);
				steps = steps.map((s) =>
					s.id !== su.id
						? s
						: {
								...s,
								title: su.title?.trim() ?? s.title,
								done_at: su.done === undefined ? s.done_at : su.done ? (s.done_at ?? this.at) : null,
								do_by: su.do_by === undefined ? s.do_by : su.do_by,
								assignee: owner === undefined ? s.assignee : owner,
							},
				);
			}
			steps = [...steps, ...(await this.buildSteps(changes.add_steps))];
			u.steps = steps;
			what.push("updated the steps");
		}
		if (what.length === 0) throw new Error("Nothing to change");
		u.history = [...task.history, historyEntry(this.actor, what.join(", "), this.at)];
		await this.write([{ kind: "update", path: await this.taskPath(id), data: u }]);
		return this.describe({ ...task, ...u });
	}

	async addNote(id: string, text: string) {
		const task = await this.getTask(id);
		const notes = [...task.notes, { id: newId(), text: text.trim(), uid: this.uid, via: "mcp" as const, at: this.at }];
		await this.write([{ kind: "update", path: await this.taskPath(id), data: { notes } }]);
		return this.describe({ ...task, notes });
	}

	async complete(id: string, details: { outcome_note?: string | null; when?: DateString | null }) {
		const task = await this.getTask(id);
		if (task.done_at) throw new Error(`"${task.title}" is already done`);
		const { update, next } = completeTask(task, this.actor, this.at, details);
		const writes: Write[] = [{ kind: "update", path: await this.taskPath(id), data: update }];
		if (next) {
			const { id: nextId, ...data } = next;
			writes.push({ kind: "create", path: await this.taskPath(nextId), data });
		}
		await this.write(writes);
		return {
			done: await this.describe({ ...task, ...update }),
			next_occurrence: next ? await this.describe(next) : undefined,
		};
	}

	async reopen(id: string) {
		const task = await this.getTask(id);
		if (!task.done_at) throw new Error(`"${task.title}" isn't done`);
		const u = reopenTask(task, this.actor, this.at);
		await this.write([{ kind: "update", path: await this.taskPath(id), data: u }]);
		return this.describe({ ...task, ...u });
	}

	async skip(id: string) {
		const task = await this.getTask(id);
		if (!task.repeat) throw new Error(`"${task.title}" doesn't repeat`);
		const u = skipOccurrence(task, this.actor, this.at);
		await this.write([{ kind: "update", path: await this.taskPath(id), data: u }]);
		return this.describe({ ...task, ...u });
	}

	/** Puts the given tasks at the top of Now, in this order. */
	async reorderNow(ids: string[]) {
		const tasks = await Promise.all(ids.map((id) => this.getTask(id)));
		const writes: Write[] = [];
		for (const [i, t] of tasks.entries()) {
			writes.push({
				kind: "update",
				path: await this.taskPath(t.id),
				data: { rank: i + 1, history: [...t.history, historyEntry(this.actor, "reordered", this.at)] },
			});
		}
		await this.write(writes);
		return tasks.map((t, i) => ({ position: i + 1, id: t.id, title: t.title }));
	}

	async defer(ids: string[], to: "month" | "later" | DateString) {
		const tasks = await Promise.all(ids.map((id) => this.getTask(id)));
		const writes: Write[] = [];
		const out: Task[] = [];
		for (const t of tasks) {
			const u: Partial<Task> =
				to === "month" || to === "later" ? moveToHorizon(t, to, this.now) : { do_by: to };
			u.history = [...t.history, historyEntry(this.actor, `deferred to ${to === "month" ? "this month" : to}`, this.at)];
			writes.push({ kind: "update", path: await this.taskPath(t.id), data: u });
			out.push({ ...t, ...u });
		}
		await this.write(writes);
		return Promise.all(out.map((t) => this.describe(t)));
	}

	async remove(id: string) {
		const task = await this.getTask(id);
		await this.write([{ kind: "delete", path: await this.taskPath(id) }]);
		return { deleted: task.title };
	}

	// ── House rules ──────────────────────────────────────────────────────────

	async getHouseRules(fallback: string) {
		const h = await this.getHousehold();
		const doc = await this.db.get<{ house_rules?: { text: string; updated_at: string; updated_by: string } }>(`households/${h.id}`);
		const rules = doc?.data.house_rules;
		return rules
			? { text: rules.text, updated: `${localDay(rules.updated_at)} by ${h.member_names[rules.updated_by] ?? "someone"}` }
			: { text: fallback, updated: "never edited: this is the starting draft" };
	}

	async setHouseRules(text: string) {
		const h = await this.getHousehold();
		const doc = await this.db.get<{ house_rules?: unknown; house_rules_history?: unknown[] }>(`households/${h.id}`);
		const history = [...(doc?.data.house_rules ? [doc.data.house_rules] : []), ...(doc?.data.house_rules_history ?? [])].slice(0, 20);
		await this.write([
			{
				kind: "update",
				path: `households/${h.id}`,
				data: { house_rules: { text, updated_at: this.at, updated_by: this.uid }, house_rules_history: history },
			},
		]);
		return { saved: true, previous_versions_kept: history.length };
	}
}

function asTask(doc: Doc<Omit<Task, "id">>): Task {
	const d = doc.data;
	return {
		...d,
		id: doc.id,
		assignee: d.assignee ?? [],
		steps: d.steps ?? [],
		notes: d.notes ?? [],
		history: d.history ?? [],
		repeat: d.repeat ?? null,
	} as Task;
}
