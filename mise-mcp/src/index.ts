import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { Firestore, type ServiceAccount } from "../../mcp-worker/src/firestore";
import { AuthHandler, type Props } from "./auth";
import { SERVER_INSTRUCTIONS } from "./guidance";
import { MiseData, type ListName } from "./mise";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const day = z.enum(["mon", "tue", "wed", "thu", "fri"]).describe("mon, tue, wed, thu or fri");
const category = z
	.enum(["produce", "dairy", "meat", "fish", "bakery", "pantry", "frozen", "drinks", "other"])
	.describe("produce, dairy, meat, fish, bakery, pantry, frozen, drinks or other. Leave out to let Mise guess, as the app does.");
const list = z
	.enum(["grocery", "staples", "costco", "supplies"])
	.describe("grocery = the grocery list; staples = bought most trips; costco = the Costco list; supplies = what's already at home");
const recipeId = z.string().min(1).describe("Recipe id, from list_recipes");
const itemId = z.string().min(1).describe("Item id, from get_lists or get_week_plan");
const ingredient = z.union([
	z.string().min(1).max(300).describe('A line like "2 cloves garlic, minced"'),
	z.object({ amount: z.string().max(40).optional(), unit: z.string().max(40).optional(), name: z.string().min(1).max(200) }),
]);

function weekdayIn(timeZone: string): string {
	return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(new Date()).toLowerCase();
}

export class MiseMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({ name: "Mise", version: "0.1.0" }, { instructions: SERVER_INSTRUCTIONS });

	/** A fresh view for one tool call. */
	private data(): MiseData {
		const emulatorHost = this.env.FIRESTORE_EMULATOR_HOST;
		const db = new Firestore({
			projectId: this.env.FIREBASE_PROJECT_ID,
			emulatorHost,
			serviceAccount: emulatorHost ? undefined : (JSON.parse(this.env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount),
		});
		return new MiseData(db, this.props!.uid, weekdayIn(this.env.TIMEZONE));
	}

	/** Logs the call (never secrets) and turns failures into a readable tool error. */
	private async run(tool: string, args: unknown, fn: (d: MiseData) => Promise<unknown>): Promise<ToolResult> {
		const started = Date.now();
		try {
			const result = await fn(this.data());
			console.log(JSON.stringify({ tool, args, ok: true, ms: Date.now() - started }));
			return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.log(JSON.stringify({ tool, args, ok: false, error: message }));
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
			"get_week_plan",
			{
				description:
					"This week's dinner plan, Monday to Friday: each day's meal (a recipe or a free-text idea) and the grocery items for that day. Also today's weekday.",
				annotations: { readOnlyHint: true },
			},
			async () => this.run("get_week_plan", {}, (d) => d.getWeekPlan()),
		);

		s.registerTool(
			"set_meal",
			{
				description:
					"Set or clear one day's dinner. Give a recipe (recipe_id, or its exact recipe_title) or a free-text label; give none of them to clear the day. A recipe's ingredients go on the grocery list for that day, and the previous recipe's come off, just like in the app.",
				inputSchema: {
					day,
					recipe_id: recipeId.optional(),
					recipe_title: z.string().min(1).max(200).optional().describe("A recipe's exact title, instead of recipe_id"),
					label: z.string().min(1).max(200).optional().describe('A meal with no recipe, e.g. "Leftovers" or "Pizza night"'),
					add_ingredients: z.boolean().optional().describe("Default true. false plans the recipe without touching the grocery list."),
				},
			},
			async ({ day, recipe_id, recipe_title, label, add_ingredients }) =>
				this.run("set_meal", { day, recipe_id, recipe_title, label }, (d) => {
					if ([recipe_id, recipe_title, label].filter((v) => v !== undefined).length > 1) {
						throw new Error("Give only one of recipe_id, recipe_title or label.");
					}
					const meal = recipe_id ? { recipe_id } : recipe_title ? { recipe_title } : label ? { label } : null;
					return d.setMeal(day, meal, add_ingredients ?? true);
				}),
		);

		s.registerTool(
			"swap_meals",
			{
				description: "Swap two days' dinners. Each day's grocery items move with its meal.",
				inputSchema: { a: day, b: day },
			},
			async ({ a, b }) => this.run("swap_meals", { a, b }, (d) => d.swapMeals(a, b)),
		);

		s.registerTool(
			"get_lists",
			{
				description:
					"The grocery list, staples, Costco list and supplies (what's at home), with item ids. Grocery, Costco and supplies are grouped by category; grocery items show the day and recipe they came from.",
				inputSchema: { lists: z.array(list).min(1).optional().describe("Default all four") },
				annotations: { readOnlyHint: true },
			},
			async ({ lists }) =>
				this.run("get_lists", { lists }, (d) => d.getLists(lists ?? ["grocery", "staples", "costco", "supplies"])),
		);

		s.registerTool(
			"add_items",
			{
				description:
					"Add items to one list. Items already on it (and not yet ticked) are skipped and reported. Categories are guessed as in the app unless given.",
				inputSchema: {
					list,
					items: z
						.array(
							z.object({
								text: z.string().min(1).max(200).describe('As it should read on the list, e.g. "2 lemons"'),
								category: category.optional(),
								day: day.optional().describe("Grocery only: the day's meal it's for"),
							}),
						)
						.min(1)
						.max(50),
				},
			},
			async ({ list, items }) => this.run("add_items", { list, count: items.length }, (d) => d.addItems(list, items)),
		);

		s.registerTool(
			"update_item",
			{
				description:
					"Change an item on a list: tick or untick it (not supplies), rename it, change its category (remembered for next time, as in the app), or move a grocery item to another day (null for no day).",
				inputSchema: {
					list,
					id: itemId,
					text: z.string().min(1).max(200).optional(),
					checked: z.boolean().optional(),
					category: category.optional(),
					day: day.nullable().optional(),
				},
			},
			async ({ list, id, ...changes }) =>
				this.run("update_item", { list, id, fields: Object.keys(changes) }, (d) => d.updateItem(list as ListName, id, changes)),
		);

		s.registerTool(
			"remove_items",
			{
				description: "Remove items from one list, e.g. supplies that are used up or something added by mistake.",
				inputSchema: { list, ids: z.array(itemId).min(1).max(100) },
				annotations: { destructiveHint: true },
			},
			async ({ list, ids }) => this.run("remove_items", { list, count: ids.length }, (d) => d.removeItems(list, ids)),
		);

		s.registerTool(
			"clear_checked",
			{
				description: "The app's Clear checked, after a shop: removes ticked grocery items and unticks staples. Doesn't touch the Costco list.",
				annotations: { destructiveHint: true },
			},
			async () => this.run("clear_checked", {}, (d) => d.clearChecked()),
		);

		s.registerTool(
			"list_recipes",
			{
				description:
					"The recipe box: each recipe's id, title, servings, key ingredients, which key supplies at home it would use, and which days it's planned on. Optionally filter by words in the title, ingredients or notes.",
				inputSchema: { query: z.string().min(1).max(100).optional() },
				annotations: { readOnlyHint: true },
			},
			async ({ query }) => this.run("list_recipes", { query }, (d) => d.listRecipes(query)),
		);

		s.registerTool(
			"get_recipe",
			{
				description: "One recipe in full: ingredients, steps, notes, source.",
				inputSchema: { id: recipeId },
				annotations: { readOnlyHint: true },
			},
			async ({ id }) => this.run("get_recipe", { id }, (d) => d.getRecipe(id)),
		);

		s.registerTool(
			"add_recipe",
			{
				description:
					"Add a recipe to the recipe box. Ingredients can be lines (\"1/2 cup olive oil\") or {amount, unit, name}. From a web page, keep its source_url and image. Propose a recipe you wrote or adapted before adding it.",
				inputSchema: {
					title: z.string().min(1).max(200),
					servings: z.number().int().min(1).max(100).optional().describe("Default 4"),
					ingredients: z.array(ingredient).max(100).optional(),
					steps: z.array(z.string().min(1).max(2000)).max(100).optional(),
					notes: z.string().max(4000).optional(),
					source_url: z.string().url().optional(),
					image: z.string().url().optional().describe("An image URL"),
				},
			},
			async (args) => this.run("add_recipe", { title: args.title }, (d) => d.addRecipe(args)),
		);

		s.registerTool(
			"update_recipe",
			{
				description:
					"Change a recipe. Ingredients and steps, when given, replace the whole list, so read it with get_recipe first. null clears notes, source_url or image. Grocery items already on the list aren't changed.",
				inputSchema: {
					id: recipeId,
					title: z.string().min(1).max(200).optional(),
					servings: z.number().int().min(1).max(100).optional(),
					ingredients: z.array(ingredient).max(100).optional(),
					steps: z.array(z.string().min(1).max(2000)).max(100).optional(),
					notes: z.string().max(4000).nullable().optional(),
					source_url: z.string().url().nullable().optional(),
					image: z.string().url().nullable().optional(),
				},
			},
			async ({ id, ...changes }) =>
				this.run("update_recipe", { id, fields: Object.keys(changes) }, (d) => d.updateRecipe(id, changes)),
		);

		s.registerTool(
			"delete_recipe",
			{
				description: "Delete a recipe from the recipe box. Days it's planned on are cleared, with their unticked grocery items. Confirm first.",
				inputSchema: { id: recipeId },
				annotations: { destructiveHint: true },
			},
			async ({ id }) => this.run("delete_recipe", { id }, (d) => d.deleteRecipe(id)),
		);
	}
}

const oauth = new OAuthProvider({
	apiHandler: MiseMCP.serve("/mcp"),
	apiRoute: "/mcp",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	defaultHandler: AuthHandler as any,
	tokenEndpoint: "/token",
});

export default {
	fetch: (request, env, ctx) => oauth.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
