// What the MCP tools do, on top of the same logic the Priorities app uses
// (../../priorities/src/lib), so a task Claude adds or ticks behaves exactly like
// one added or ticked in the app.
//
// The Worker reads Firestore as a service account, which bypasses security
// rules, so visibility is enforced here: a person sees the shared list and
// their own personal list, never the other person's.

import { addDays, localDay, weekEnd } from "../../priorities/src/lib/dates";
import { factsBetween } from "../../priorities/src/lib/calendar";
import { HORIZON_NAMES } from "../../priorities/src/lib/format";
import {
	WINDOW_DAYS,
	effectiveDate,
	effectiveHorizon,
	isDoneThisWeek,
	isHandledAhead,
	isOpenCheck,
	isOverdue,
	lastDay,
	moveToHorizon,
	overlaps,
} from "../../priorities/src/lib/horizon";
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
} from "../../priorities/src/lib/ops";
import { describeRepeat } from "../../priorities/src/lib/repeat";
import { canSee, isOnMe } from "../../priorities/src/lib/visibility";
import type { CalendarFact, DateString, Household, Horizon, RadarRun, RepeatRule, Step, Task } from "../../priorities/src/types";
import type { Doc, Firestore, Write } from "./firestore";

export type OwnerWord = "me" | "partner" | "both" | "unclaimed";
export type ListWord = "mine" | "shared" | "all";
export type HorizonWord = Horizon | "gaps" | "handled" | "done";

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
	/** "check" = a potential gap: the radar can't tell whether it's handled. */
	kind?: "task" | "check";
	/** Checks: the date in question (and last day of a range). */
	when?: DateString | null;
	when_end?: DateString | null;
	radar_key?: string | null;
}

/** A radar run counts as this week's shared sweep for this long. */
const SWEEP_DAYS = 5;

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
	when_end?: DateString | null;
	/** "task" turns a potential gap into a normal task. */
	kind?: "task" | "check";
}

export class NotFound extends Error {}

export class PrioritiesData {
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
			throw new Error("No Priorities household yet. Open the Priorities app and start or join one first.");
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
			section: this.sectionOf(task),
			status: done ? "done" : "open",
			horizon: done || isOpenCheck(task) ? undefined : effectiveHorizon(task, this.now),
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
			when_end: task.when_end ?? undefined,
			radar_key: task.radar_key ?? undefined,
			added: `${localDay(task.created_at)} by ${name(task.created_by.uid)}${task.created_by.via === "mcp" ? " via Claude" : ""}`,
		};
	}

	/** Emily's categories, as the app shows them. */
	private sectionOf(task: Task): string {
		if (isOpenCheck(task)) return "⚠️ Potential gap";
		if (task.done_at) return isHandledAhead(task, this.now) ? "🟢 Already handled" : "Done";
		const h = effectiveHorizon(task, this.now);
		return `${{ now: "🔴", month: "🟡", later: "⚪" }[h]} ${HORIZON_NAMES[h]}`;
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
		if (h === "handled") tasks = tasks.filter((t) => isHandledAhead(t, this.now));
		else if (h === "gaps") tasks = tasks.filter(isOpenCheck);
		else if (h === "done") tasks = tasks.filter((t) => t.done_at && (!opts.done_since || localDay(t.done_at) >= opts.done_since));
		else if (opts.done_since) tasks = tasks.filter((t) => t.done_at && localDay(t.done_at) >= opts.done_since!);
		else {
			tasks = tasks.filter((t) => !t.done_at && !isOpenCheck(t));
			if (h) tasks = tasks.filter((t) => effectiveHorizon(t, this.now) === h);
		}
		tasks.sort(compareOpen);
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
		const open = tasks.filter((t) => !t.done_at && !isOpenCheck(t));
		const people = h.members.map((uid) => {
			const on = open.filter((t) => (t.list === "personal" ? t.owner_uid === uid : t.assignee.includes(uid)));
			const count = (hz: Horizon) => on.filter((t) => effectiveHorizon(t, this.now) === hz).length;
			return {
				name: h.member_names[uid],
				is_me: uid === this.uid,
				needs_action_now: count("now"),
				coming_up: count("month"),
				not_yet: count("later"),
				needs_action_now_titles: on
					.filter((t) => effectiveHorizon(t, this.now) === "now")
					.sort(compareOpen)
					.map((t) => t.title),
			};
		});
		const windowEnd = addDays(this.now, WINDOW_DAYS);
		return {
			today: this.now,
			week_ends: weekEnd(this.now),
			radar_window_ends: windowEnd,
			sections:
				"🔴 Needs action now = this week and overdue; 🟡 Coming up = through radar_window_ends; ⚪ Not yet = after that; ⚠️ Potential gaps = open checks; 🟢 Already handled = done with a date ahead. The top 3 of each person's Needs action now are their top 3 for the week.",
			note: "Counts for the other person include only shared tasks; their personal list is private.",
			people,
			overdue: open.filter((t) => isOverdue(t, this.now)).map((t) => ({ id: t.id, title: t.title, was_due: effectiveDate(t) })),
			unclaimed_shared: open
				.filter((t) => t.list === "shared" && t.assignee.length === 0)
				.map((t) => ({ id: t.id, title: t.title, horizon: effectiveHorizon(t, this.now) })),
			potential_gaps: tasks
				.filter(isOpenCheck)
				.map((t) => ({ id: t.id, title: t.title, when: t.when, when_end: t.when_end ?? undefined })),
			already_handled_next_6_weeks: tasks
				.filter((t) => isHandledAhead(t, this.now) && t.when! <= windowEnd)
				.sort((a, b) => (a.when! < b.when! ? -1 : 1))
				.map((t) => ({ id: t.id, title: t.title, when: t.when, when_end: t.when_end ?? undefined, outcome_note: t.outcome_note })),
			done_this_week: tasks.filter((t) => isDoneThisWeek(t, this.now)).map((t) => t.title),
		};
	}

	// ── Writing ──────────────────────────────────────────────────────────────

	private async write(writes: Write[]) {
		await this.db.commit(writes);
		// The household document may have changed; read it fresh next time.
		if (writes.some((w) => w.path.split("/").length === 2)) this.household = undefined;
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
		const skipped: { title: string; radar_key: string; already: string }[] = [];
		// Radar keys already used, open or done, so neither of our radars adds the same thing twice
		// (and a gap someone answered "covered" doesn't come back next week).
		const keys = new Map<string, Task>();
		if (inputs.some((i) => i.radar_key)) {
			for (const t of await this.visibleTasks()) if (t.radar_key) keys.set(t.radar_key, t);
		}
		for (const input of inputs) {
			const key = input.radar_key?.trim().toLowerCase() || null;
			if (key && keys.has(key)) {
				const t = keys.get(key)!;
				skipped.push({ title: input.title, radar_key: key, already: `${t.title} (${this.sectionOf(t)}, id ${t.id})` });
				continue;
			}
			if (input.kind === "check" && !input.when) throw new Error(`"${input.title}": a check needs the date in question (when)`);
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
					kind: input.kind ?? "task",
					when: input.when ?? null,
					when_end: input.when_end ?? null,
					radar_key: key,
				},
				this.actor,
				this.at,
			);
			if (key) keys.set(key, task);
			if (task.repeat && !task.do_by && !task.deadline) task.do_by = this.now;
			task.steps = await this.buildSteps(input.steps);
			if (input.note?.trim()) task.notes = [{ id: newId(), text: input.note.trim(), uid: this.uid, via: "mcp", at: this.at }];
			const { id, ...data } = task;
			writes.push({ kind: "create", path: await this.taskPath(id), data });
			created.push(task);
		}
		if (writes.length) await this.write(writes);
		const added = await Promise.all(created.map((t) => this.describe(t)));
		return skipped.length ? { added, skipped_already_tracked: skipped } : added;
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
		for (const k of ["do_by", "deadline", "source_url", "outcome_note", "when", "when_end"] as const) {
			if (changes[k] !== undefined) {
				(u as Record<string, unknown>)[k] = changes[k];
				what.push(`changed ${k.replace("_", " ")}`);
			}
		}
		// A dated task re-files by its new date.
		if (changes.do_by !== undefined || changes.deadline !== undefined) u.order = null;
		if (changes.kind && changes.kind !== (task.kind ?? "task")) {
			u.kind = changes.kind;
			if (changes.kind === "task" && !(u.deadline ?? task.deadline) && task.when) u.deadline = task.when;
			what.push(changes.kind === "task" ? "added to the list" : "marked as a potential gap");
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

	async complete(id: string, details: { outcome_note?: string | null; when?: DateString | null; when_end?: DateString | null }) {
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

	/** Puts the given tasks at the top of their sections, in this order; the rest follow by date. */
	async reorderNow(ids: string[]) {
		const tasks = await Promise.all(ids.map((id) => this.getTask(id)));
		const writes: Write[] = [];
		for (const [i, t] of tasks.entries()) {
			writes.push({
				kind: "update",
				path: await this.taskPath(t.id),
				// Small numbers sort before any date (dates order by their milliseconds).
				data: { order: i + 1, history: [...t.history, historyEntry(this.actor, "reordered", this.at)] },
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
			if (to !== "month" && to !== "later") u.order = null;
			u.history = [...t.history, historyEntry(this.actor, `deferred to ${to === "month" ? "Coming up" : to === "later" ? "Not yet" : to}`, this.at)];
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

	// ── Radar ────────────────────────────────────────────────────────────────

	/** One line per task, for the radar's wide view. */
	private async brief(t: Task) {
		const d = await this.describe(t);
		return {
			id: d.id,
			title: d.title,
			section: d.section,
			list: d.list,
			owner: d.owner,
			date: t.done_at || isOpenCheck(t) ? (t.when ?? undefined) : (effectiveDate(t) ?? undefined),
			when_end: d.when_end,
			deadline: d.deadline,
			outcome_note: d.outcome_note,
			radar_key: d.radar_key,
		};
	}

	/** Everything with a date touching from..to, open or done, plus school calendar days in that span. */
	async coverage(from: DateString, to: DateString) {
		if (to < from) throw new Error("'to' is before 'from'");
		const h = await this.getHousehold();
		const tasks = (await this.visibleTasks()).filter((t) => overlaps(t, from, to));
		const pick = (f: (t: Task) => boolean) => Promise.all(tasks.filter(f).map((t) => this.brief(t)));
		return {
			from,
			to,
			school_calendar: factsBetween(h.calendar_facts ?? [], from, to),
			already_handled: await pick((t) => t.done_at !== null),
			potential_gaps: await pick(isOpenCheck),
			open_tasks: await pick((t) => !t.done_at && !isOpenCheck(t)),
			note: "Only what's recorded in Priorities. A booking that's only in email or on a calendar won't show here.",
		};
	}

	/**
	 * Starts a weekly radar run: everything it needs in one call, and whether
	 * this run does the shared sweep. The first run in any 5 days claims it, so
	 * when both of our radars run, the second only looks at its own person's list.
	 */
	async startRadar(fallbackRules: string) {
		const h = await this.getHousehold();
		const cutoff = new Date(Date.parse(this.at) - SWEEP_DAYS * 86_400_000).toISOString();
		const runs = h.radar_runs ?? [];
		const lastShared = runs.find((r) => r.shared && r.at >= cutoff);
		const claim = h.radar_claim && h.radar_claim.at >= cutoff && h.radar_claim.uid !== this.uid ? h.radar_claim : null;
		const sweep = !lastShared && !claim;
		const name = (uid: string) => h.member_names[uid] ?? "someone";
		if (sweep) {
			await this.write([{ kind: "update", path: `households/${h.id}`, data: { radar_claim: { uid: this.uid, at: this.at } } }]);
		}

		const windowEnd = addDays(this.now, WINDOW_DAYS);
		const tasks = await this.visibleTasks();
		const recent = (t: Task) => (lastDay(t) ?? effectiveDate(t) ?? this.now) >= addDays(this.now, -7);
		const open = tasks.filter((t) => !t.done_at && !isOpenCheck(t) && effectiveHorizon(t, this.now) !== "later");
		const rules = await this.getHouseRules(fallbackRules);
		return {
			today: this.now,
			week_ends: weekEnd(this.now),
			window_ends: windowEnd,
			shared_sweep: sweep
				? { yours: true, why: "No shared sweep in the last 5 days, so this run does it: school, childcare, and the shared list." }
				: {
						yours: false,
						why: lastShared
							? `${name(lastShared.uid)}'s radar did the shared sweep on ${localDay(lastShared.at)}. Look only at your own personal list and anything only you would know about (your email and calendar); add shared items only if they are new.`
							: `${name(claim!.uid)}'s radar started the shared sweep on ${localDay(claim!.at)}. Look only at your own list and anything only you would know about.`,
					},
			recent_runs: runs
				.filter((r) => r.at >= cutoff)
				.map((r) => ({ by: name(r.uid), on: localDay(r.at), shared_sweep: r.shared, summary: r.summary })),
			house_rules: rules.text,
			school_calendar: {
				feeds: (h.calendar_feeds ?? []).map((f) => f.name),
				last_read: h.calendar_refreshed_at ? localDay(h.calendar_refreshed_at) : "never",
				problems: h.calendar_errors?.length ? h.calendar_errors : undefined,
				days: factsBetween(h.calendar_facts ?? [], this.now, windowEnd),
			},
			potential_gaps: await Promise.all(tasks.filter(isOpenCheck).map((t) => this.brief(t))),
			already_handled: await Promise.all(
				tasks.filter((t) => isHandledAhead(t, this.now) && t.when! <= windowEnd).map((t) => this.brief(t)),
			),
			open_through_window: await Promise.all(open.sort(compareOpen).map((t) => this.brief(t))),
			radar_keys_in_use: [...new Set(tasks.filter((t) => t.radar_key && recent(t)).map((t) => t.radar_key!))],
		};
	}

	/** Records what a radar run did, for the other person's radar and the app's House rules page. */
	async finishRadar(summary: string, shared: boolean) {
		const h = await this.getHousehold();
		const run: RadarRun = { uid: this.uid, at: this.at, shared, summary: summary.trim() };
		const runs = [run, ...(h.radar_runs ?? [])].slice(0, 12);
		await this.write([{ kind: "update", path: `households/${h.id}`, data: { radar_runs: runs } }]);
		return { recorded: true };
	}

	// ── School calendar ──────────────────────────────────────────────────────

	/** Adds dates by hand, e.g. from a school calendar PDF someone pasted. Kept when the feeds refresh. */
	async addSchoolDates(dates: { date: DateString; end?: DateString | null; title: string; kind?: CalendarFact["kind"] }[]) {
		const h = await this.getHousehold();
		const facts = [...(h.calendar_facts ?? [])];
		const seen = new Set(facts.map((f) => `${f.date}|${f.title.toLowerCase()}`));
		let added = 0;
		for (const d of dates) {
			const key = `${d.date}|${d.title.trim().toLowerCase()}`;
			if (seen.has(key)) continue;
			seen.add(key);
			facts.push({ date: d.date, end: d.end && d.end > d.date ? d.end : null, title: d.title.trim(), kind: d.kind ?? "no_school", source: "manual" });
			added++;
		}
		facts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
		await this.write([{ kind: "update", path: `households/${h.id}`, data: { calendar_facts: facts } }]);
		return { added, already_there: dates.length - added };
	}

	async householdForCalendar() {
		return this.getHousehold();
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
		kind: d.kind ?? "task",
		order: typeof d.order === "number" ? d.order : null,
		when_end: d.when_end ?? null,
		radar_key: d.radar_key ?? null,
	} as Task;
}
