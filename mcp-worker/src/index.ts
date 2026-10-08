import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { setTimeZone, today } from "../../tandem/src/lib/dates";
import { AuthHandler, type Props } from "./auth";
import { Firestore, type ServiceAccount } from "./firestore";
import { DEFAULT_HOUSE_RULES, PLAN_MY_WEEK, SERVER_INSTRUCTIONS } from "./guidance";
import { TandemData } from "./tasks";

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

export class TandemMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({ name: "Tandem", version: "0.1.0" }, { instructions: SERVER_INSTRUCTIONS });

	private db(): Firestore {
		const emulatorHost = this.env.FIRESTORE_EMULATOR_HOST;
		return new Firestore({
			projectId: this.env.FIREBASE_PROJECT_ID,
			emulatorHost,
			serviceAccount: emulatorHost ? undefined : (JSON.parse(this.env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount),
		});
	}

	/** A fresh view for one tool call: dates are "now" in our time zone. */
	private data(): TandemData {
		setTimeZone(this.env.TIMEZONE);
		return new TandemData(this.db(), this.props!.uid, today(), new Date().toISOString());
	}

	/** Logs the call (never secrets) and turns failures into a readable tool error. */
	private async run(tool: string, args: unknown, fn: (d: TandemData) => Promise<unknown>): Promise<ToolResult> {
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
					"Start here when planning or answering 'what's on'. Today's date, each person's Now / This month / Later counts and Now titles, overdue tasks, unclaimed shared tasks, what's taken care of in the next 4 weeks, and what got done this week.",
				annotations: { readOnlyHint: true },
			},
			async () => this.run("get_overview", {}, (d) => d.overview()),
		);

		s.registerTool(
			"list_tasks",
			{
				description:
					"List tasks with full details (steps, notes, outcome). Defaults to all open tasks. Now tasks come in their manual order; the rest by date.",
				inputSchema: {
					list: z.enum(["mine", "shared", "all"]).optional().describe("mine = my personal list + shared tasks on me (default all)"),
					horizon: z
						.enum(["now", "month", "later", "taken_care_of", "done"])
						.optional()
						.describe("taken_care_of = done with a date still ahead; done = finished tasks"),
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
					"Add one or more tasks. Propose bulk adds to the person first. Set dates whenever they exist, put the source in note or source_url, and break big jobs into steps.",
				inputSchema: {
					tasks: z
						.array(
							z.object({
								title: z.string().min(1).max(200).describe("Starts with a verb"),
								list: z.enum(["shared", "personal"]).describe("personal = only the connected person sees it"),
								owner: owner.optional().describe("Shared tasks only (default unclaimed). Ask if unsure."),
								horizon: z.enum(["now", "month", "later"]).optional().describe("For undated tasks only (default now)"),
								do_by: date.optional().describe("When to act; places the task"),
								deadline: date.optional().describe("The hard date"),
								repeat: repeat.optional(),
								steps: z.array(step).max(20).optional(),
								note: z.string().max(2000).optional().describe("Context: where it came from, reference numbers"),
								source_url: z.string().url().optional(),
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
					"Mark a task done. Record the outcome when there is one (who, when, where, confirmation number) and set 'when' to the date it's about, so it shows under Taken care of until then. A repeating task also gets its next occurrence.",
				inputSchema: {
					id: taskId,
					outcome_note: z.string().max(2000).optional(),
					when: date.optional().describe("The appointment, trip or due date this covers"),
				},
			},
			async ({ id, outcome_note, when }) =>
				this.run("complete_task", { id, when }, (d) => d.complete(id, { outcome_note, when })),
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
					"Set the order of the top of a Now list: the given tasks go first, in this order; others follow. Propose the order first.",
				inputSchema: { ids: z.array(z.string()).min(1).max(30) },
			},
			async ({ ids }) => this.run("reorder_now", { count: ids.length }, (d) => d.reorderNow(ids)),
		);

		s.registerTool(
			"defer_tasks",
			{
				description:
					"Push tasks out of Now: to 'month' (from next Monday), 'later' (5+ weeks out), or to a specific do-by date. Propose first.",
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

		s.registerPrompt(
			"plan_my_week",
			{ title: "Plan my week", description: "Review both lists and the calendar, then propose this week's plan." },
			async () => ({ messages: [{ role: "user", content: { type: "text", text: PLAN_MY_WEEK } }] }),
		);
	}
}

export default new OAuthProvider({
	apiHandler: TandemMCP.serve("/mcp"),
	apiRoute: "/mcp",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	defaultHandler: AuthHandler as any,
	tokenEndpoint: "/token",
});
