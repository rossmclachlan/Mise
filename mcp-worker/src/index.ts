import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { setTimeZone, today } from "../../priorities/src/lib/dates";
import { DEFAULT_HOUSE_RULES } from "../../priorities/src/lib/houseRules";
import { AuthHandler, type Props } from "./auth";
import { refreshAll, refreshHousehold } from "./calendar";
import { Firestore, type ServiceAccount } from "./firestore";
import { SERVER_INSTRUCTIONS, WEEKLY_RADAR } from "./guidance";
import { PrioritiesData } from "./tasks";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
const taskId = z.string().min(1).describe("Task id, from list_tasks, search_tasks or get_overview");
const owner = z
	.enum(["me", "partner", "both", "unclaimed"])
	.describe("Who it's on, from the connected person's point of view: me, partner, both, or unclaimed");
const stepOwner = z.enum(["me", "partner", "unclaimed"]);
const repeat = z
	.object({
		every: z.number().int().min(1).max(365),
		unit: z.enum(["day", "week", "month", "year"]),
		mode: z
			.enum(["schedule", "after_done"])
			.describe("schedule: stays on the calendar (trash every Thursday). after_done: counted from when it was last done (filter every 3 months)."),
	})
	.describe("How the task repeats. Ticking it creates the next one.");
const step = z.object({
	title: z.string().min(1).max(200),
	do_by: date.optional(),
	owner: stepOwner.optional().describe("Shared tasks: who does this step"),
});

const radarKey = z
	.string()
	.min(3)
	.max(120)
	.regex(/^[a-z0-9_-]+:[0-9]{4}-[0-9]{2}-[0-9]{2}(:[a-z0-9_-]+)?$/i, "use type:YYYY-MM-DD or type:YYYY-MM-DD:slug")
	.describe(
		"Radar items only: a stable key, type:date[:slug], e.g. childcare:2026-10-12, gift:2026-11-03:grandma, registration:2026-11-01:winter-camp. A key already used (open or done, by either of us) is skipped, so the same thing is never raised twice.",
	);

function firestoreFor(env: Env): Firestore {
	const emulatorHost = env.FIRESTORE_EMULATOR_HOST;
	return new Firestore({
		projectId: env.FIREBASE_PROJECT_ID,
		emulatorHost,
		serviceAccount: emulatorHost ? undefined : (JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount),
	});
}

export class PrioritiesMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({ name: "Priorities", version: "0.2.0" }, { instructions: SERVER_INSTRUCTIONS });

	private db(): Firestore {
		return firestoreFor(this.env);
	}

	/** A fresh view for one tool call: dates are "now" in our time zone. */
	private data(): PrioritiesData {
		setTimeZone(this.env.TIMEZONE);
		return new PrioritiesData(this.db(), this.props!.uid, today(), new Date().toISOString());
	}

	/** Logs the call (never secrets) and turns failures into a readable tool error. */
	private async run(tool: string, args: unknown, fn: (d: PrioritiesData) => Promise<unknown>): Promise<ToolResult> {
		const started = Date.now();
		try {
			const result = await fn(this.data());
			console.log(JSON.stringify({ tool, uid: this.props?.uid, args, ok: true, ms: Date.now() - started }));
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.log(JSON.stringify({ tool, uid: this.props?.uid, args, ok: false, error: message }));
			return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
		}
	}

	async init() {
		const allowed = this.env.ALLOWED_UIDS.split(",").map((s) => s.trim());
		if (!this.props?.uid || !allowed.includes(this.props.uid)) {
			console.log(JSON.stringify({ event: "no_tools", uid: this.props?.uid ?? null }));
			return;
		}
		const s = this.server;

		s.registerTool(
			"get_overview",
			{
				description:
					"Start here when answering 'what's on'. Today's date, each person's counts per section (Needs action now, Coming up, Not yet) and their Needs action now titles in order (the first 3 are their top 3), overdue tasks, unclaimed shared tasks, potential gaps, what's already handled in the next 6 weeks, and what got done this week. For the weekly radar, use start_radar instead.",
				annotations: { readOnlyHint: true },
			},
			async () => this.run("get_overview", {}, (d) => d.overview()),
		);

		s.registerTool(
			"list_tasks",
			{
				description:
					"List tasks with full details (steps, notes, outcome). Defaults to all open tasks (not potential gaps). Each section comes in its order in the app: by date unless someone dragged a task.",
				inputSchema: {
					list: z.enum(["mine", "shared", "all"]).optional().describe("mine = my personal list + shared tasks on me (default all)"),
					horizon: z
						.enum(["now", "month", "later", "gaps", "handled", "done"])
						.optional()
						.describe(
							"now = 🔴 Needs action now (this week + overdue); month = 🟡 Coming up (next 6 weeks); later = ⚪ Not yet; gaps = ⚠️ Potential gaps; handled = 🟢 Already handled (done, date still ahead); done = finished tasks",
						),
					owner: owner.optional(),
					done_since: date.optional().describe("Only tasks finished on or after this date"),
				},
				annotations: { readOnlyHint: true },
			},
			async (args) => this.run("list_tasks", args, (d) => d.list(args)),
		);

		s.registerTool(
			"search_tasks",
			{
				description:
					"Find tasks by words in the title, steps, notes or outcome, open or done. Use it to answer questions like 'when is the checkup?' from what was recorded.",
				inputSchema: {
					query: z.string().min(1).max(200),
					include_done: z.boolean().optional().describe("Default true"),
				},
				annotations: { readOnlyHint: true },
			},
			async ({ query, include_done }) => this.run("search_tasks", { query }, (d) => d.search(query, include_done ?? true)),
		);

		s.registerTool(
			"add_tasks",
			{
				description:
					"Add tasks, or potential gaps (kind: check). Propose bulk adds first, except a scheduled radar run may add potential gaps on its own. Set dates whenever they exist, put the source or evidence in note or source_url, and break big jobs into steps. Items with a radar_key that's already in use are skipped and reported.",
				inputSchema: {
					tasks: z
						.array(
							z.object({
								title: z.string().min(1).max(200).describe("Starts with a verb"),
								list: z.enum(["shared", "personal"]).describe("personal = only the connected person sees it"),
								owner: owner.optional().describe("Shared tasks only (default unclaimed). Ask if unsure."),
								horizon: z
									.enum(["now", "month", "later"])
									.optional()
									.describe("For undated tasks only (default now): now = Needs action now, month = Coming up, later = Not yet"),
								do_by: date.optional().describe("When to act; places the task"),
								deadline: date.optional().describe("The hard date"),
								repeat: repeat.optional(),
								steps: z.array(step).max(20).optional(),
								note: z.string().max(2000).optional().describe("Context: where it came from, reference numbers"),
								source_url: z.string().url().optional(),
									kind: z
										.enum(["task", "check"])
										.optional()
										.describe("check = a potential gap: something that may need doing, and you can't tell whether it's handled. Shown under Potential gaps until someone answers it."),
									when: date.optional().describe("Checks: the date in question (required for a check)"),
									when_end: date.optional().describe("Checks: the last day, for a range"),
									radar_key: radarKey.optional(),
								}),
								)
								.min(1)
								.max(25),
				},
			},
			async ({ tasks }) => this.run("add_tasks", { count: tasks.length }, (d) => d.add(tasks)),
		);

		s.registerTool(
			"update_task",
			{
				description:
					"Change a task: title, list, owner, dates, repeat, source, steps (add, update or remove), or for a done task its outcome_note and when. Pass null to clear a date.",
				inputSchema: {
					id: taskId,
					title: z.string().min(1).max(200).optional(),
					list: z.enum(["shared", "personal"]).optional(),
					owner: owner.optional(),
					do_by: date.nullable().optional(),
					deadline: date.nullable().optional(),
					repeat: repeat.nullable().optional(),
					source_url: z.string().url().nullable().optional(),
					add_steps: z.array(step).max(20).optional(),
					update_steps: z
						.array(
							z.object({
								id: z.string(),
								title: z.string().min(1).max(200).optional(),
								done: z.boolean().optional(),
								do_by: date.nullable().optional(),
								owner: stepOwner.optional(),
							}),
						)
						.optional(),
					remove_step_ids: z.array(z.string()).optional(),
					outcome_note: z.string().max(2000).nullable().optional(),
					when: date.nullable().optional(),
					when_end: date.nullable().optional().describe("Last day, when 'when' is a range"),
					kind: z.enum(["task", "check"]).optional().describe("task turns a potential gap into a normal task"),
					},
					},
			async ({ id, ...changes }) => this.run("update_task", { id, fields: Object.keys(changes) }, (d) => d.update(id, changes)),
		);

		s.registerTool(
			"add_note",
			{
				description: "Add an entry to a task's notes log (who said what, when). For context, progress, phone numbers.",
				inputSchema: { id: taskId, text: z.string().min(1).max(2000) },
			},
			async ({ id, text }) => this.run("add_note", { id }, (d) => d.addNote(id, text)),
		);

		s.registerTool(
			"complete_task",
			{
				description:
					"Mark a task done, or answer a potential gap as covered. Record the outcome (who, when, where, confirmation number; for a gap, how it's covered or why it's not needed) and set 'when' (and when_end for a range like camp Nov 25-27) to the dates it covers, so it shows under Already handled until then. A repeating task also gets its next occurrence.",
					inputSchema: {
						id: taskId,
						outcome_note: z.string().max(2000).optional(),
						when: date.optional().describe("The appointment, trip or due date this covers"),
						when_end: date.optional().describe("The last day it covers, for a range"),
					},
					},
					async ({ id, outcome_note, when, when_end }) =>
						this.run("complete_task", { id, when, when_end }, (d) => d.complete(id, { outcome_note, when, when_end })),
		);

		s.registerTool(
			"reopen_task",
			{ description: "Undo marking a task done.", inputSchema: { id: taskId } },
			async ({ id }) => this.run("reopen_task", { id }, (d) => d.reopen(id)),
		);

		s.registerTool(
			"skip_occurrence",
			{
				description: "Move a repeating task to its next date without marking it done ('skip this time').",
				inputSchema: { id: taskId },
			},
			async ({ id }) => this.run("skip_occurrence", { id }, (d) => d.skip(id)),
		);

		s.registerTool(
			"reorder_now",
			{
				description:
					"Put tasks at the top of their sections, in this order; the rest follow by date. For Needs action now, the first 3 are the week's top 3. Propose the order first, except a scheduled radar run may set the person's top 3.",
				inputSchema: { ids: z.array(z.string()).min(1).max(30) },
			},
			async ({ ids }) => this.run("reorder_now", { count: ids.length }, (d) => d.reorderNow(ids)),
		);

		s.registerTool(
			"defer_tasks",
			{
				description:
					"Push tasks out of Needs action now: to 'month' (Coming up, from next Monday), 'later' (Not yet, past the 6-week window), or to a specific do-by date, e.g. the month to revisit. Propose first.",
				inputSchema: {
					ids: z.array(z.string()).min(1).max(30),
					to: z.union([z.enum(["month", "later"]), date]),
				},
			},
			async ({ ids, to }) => this.run("defer_tasks", { count: ids.length, to }, (d) => d.defer(ids, to)),
		);

		s.registerTool(
			"delete_task",
			{
				description: "Delete a task added by mistake. Prefer complete_task for anything that was actually done.",
				inputSchema: { id: taskId },
				annotations: { destructiveHint: true },
			},
			async ({ id }) => this.run("delete_task", { id }, (d) => d.remove(id)),
		);

		s.registerTool(
			"get_house_rules",
			{
				description:
					"Ross and Emily's shared rules for prioritizing: ranking, lead times, focus limits, who owns what, household context. Read before planning or prioritizing.",
				annotations: { readOnlyHint: true },
			},
			async () => this.run("get_house_rules", {}, (d) => d.getHouseRules(DEFAULT_HOUSE_RULES)),
		);

		s.registerTool(
			"update_house_rules",
			{
				description:
					"Replace the house rules with a new full text (both people's Claude reads the same copy). Read them first, change only what was asked, and confirm the change with the person.",
				inputSchema: { text: z.string().min(20).max(20000) },
			},
			async ({ text }) => this.run("update_house_rules", { length: text.length }, (d) => d.setHouseRules(text)),
		);

		s.registerTool(
			"start_radar",
			{
				description:
					"Start the weekly radar. Returns the house rules, the next 6 weeks of school calendar days, potential gaps, what's already handled, open tasks, radar keys in use, recent runs, and whether this run does the shared sweep (the first run in 5 days does; the other person's radar then only covers its own person). Call once at the start of a run, then finish_radar at the end.",
			},
			async () => this.run("start_radar", {}, (d) => d.startRadar(DEFAULT_HOUSE_RULES)),
		);

		s.registerTool(
			"finish_radar",
			{
				description:
					"Record what this radar run did, in a sentence or two (what was added, set or found handled). The other person's radar reads it, and it shows on the app's House rules page.",
				inputSchema: {
					summary: z.string().min(5).max(600),
					shared_sweep: z.boolean().describe("Whether this run did the shared sweep (from start_radar)"),
				},
			},
			async ({ summary, shared_sweep }) => this.run("finish_radar", { shared_sweep }, (d) => d.finishRadar(summary, shared_sweep)),
		);

		s.registerTool(
			"check_coverage",
			{
				description:
					"What Priorities has for a span of days: school calendar days, things already handled (bookings, camps), potential gaps and open tasks whose dates touch it. Use it to tell whether a day off or trip is covered before raising it.",
				inputSchema: { from: date, to: date },
				annotations: { readOnlyHint: true },
			},
			async ({ from, to }) => this.run("check_coverage", { from, to }, (d) => d.coverage(from, to)),
		);

		s.registerTool(
			"add_school_dates",
			{
				description:
					"Add school calendar dates by hand, e.g. from a pasted calendar or PDF (no school, minimum days, breaks). Kept alongside the feeds the app reads daily. Already-listed dates are skipped.",
				inputSchema: {
					dates: z
						.array(
							z.object({
								date,
								end: date.optional().describe("Last day, for a break"),
								title: z.string().min(1).max(200),
								kind: z.enum(["no_school", "early_release", "event"]).optional().describe("Default no_school"),
							}),
						)
						.min(1)
						.max(100),
				},
			},
			async ({ dates }) => this.run("add_school_dates", { count: dates.length }, (d) => d.addSchoolDates(dates)),
		);

		s.registerTool(
			"refresh_school_calendar",
			{
				description: "Re-read the school calendar feeds now (they're read every morning anyway), e.g. after someone adds a link in the app.",
			},
			async () =>
				this.run("refresh_school_calendar", {}, async (d) =>
					refreshHousehold(this.db(), await d.householdForCalendar(), today(), new Date().toISOString()),
				),
		);

		s.registerPrompt(
			"weekly_radar",
			{
				title: "Weekly radar",
				description: "Look 6 weeks ahead for what could go wrong or needs handling now, and brief me in 2-3 minutes.",
			},
			async () => ({ messages: [{ role: "user", content: { type: "text", text: WEEKLY_RADAR } }] }),
		);
	}
}

const oauth = new OAuthProvider({
	apiHandler: PrioritiesMCP.serve("/mcp"),
	apiRoute: "/mcp",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	defaultHandler: AuthHandler as any,
	tokenEndpoint: "/token",
});

export default {
	fetch: (request, env, ctx) => oauth.fetch(request, env, ctx),
	// Daily (see triggers in wrangler.jsonc): re-read the school calendar feeds.
	async scheduled(_controller, env, ctx) {
		setTimeZone(env.TIMEZONE);
		ctx.waitUntil(refreshAll(firestoreFor(env), today(), new Date().toISOString()));
	},
} satisfies ExportedHandler<Env>;
