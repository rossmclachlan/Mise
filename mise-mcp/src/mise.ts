// Mise's data, read and written the way the app does (src/hooks/useFirestore.ts and
// the views): everything lives under users/{uid}, the one shared Mise account.
// The service account bypasses security rules, so every path here is built from
// the signed-in uid, which index.ts has already checked against ALLOWED_UIDS.

import {
	GROCERY_CATEGORIES,
	GROCERY_CATEGORY_LABELS,
	WEEK_DAYS,
	WEEK_DAY_LABELS,
	type CostcoItem,
	type GroceryCategory,
	type GroceryItem,
	type Ingredient,
	type MealPlanEntry,
	type Recipe,
	type Staple,
	type SupplyItem,
	type WeekDay,
	type WeekPlan,
} from "../../src/types";
import { categoriseItem } from "../../src/utils/categorise";
import { isKeyIngredient, matchKeySupplies } from "../../src/utils/keyIngredients";
import { parseIngredientLine } from "../../src/utils/parseIngredient";
import type { Doc, Write } from "../../mcp-worker/src/firestore";

/** The parts of the Firestore client this file uses (tests pass a fake). */
export interface Store {
	get<T>(path: string): Promise<Doc<T> | null>;
	query<T>(collectionPath: string, filters: [], limit?: number): Promise<Doc<T>[]>;
	commit(writes: Write[]): Promise<void>;
}

export class NotFound extends Error {}

export type ListName = "grocery" | "staples" | "costco" | "supplies";

const COLLECTION: Record<ListName, string> = {
	grocery: "grocery_list",
	staples: "staples",
	costco: "costco",
	supplies: "supplies",
};

/** Lists whose items have a grocery category. */
const CATEGORISED: ListName[] = ["grocery", "costco", "supplies"];
/** Lists whose items are ticked off while shopping. */
const CHECKABLE: ListName[] = ["grocery", "staples", "costco"];

type AnyItem = GroceryItem & Partial<Staple & CostcoItem & SupplyItem>;

export interface NewItem {
	text: string;
	category?: GroceryCategory;
	day?: WeekDay;
}

export interface ItemChanges {
	text?: string;
	checked?: boolean;
	category?: GroceryCategory;
	day?: WeekDay | null;
}

export type IngredientInput = string | { amount?: string; unit?: string; name: string };

export interface RecipeInput {
	title: string;
	servings?: number;
	ingredients?: IngredientInput[];
	steps?: string[];
	notes?: string;
	source_url?: string;
	image?: string;
}

export type MealInput = { recipe_id: string } | { recipe_title: string } | { label: string } | null;

const itemText = (ing: Ingredient) => [ing.amount, ing.unit, ing.name].filter(Boolean).join(" ");

function toIngredient(i: IngredientInput): Ingredient {
	if (typeof i === "string") return parseIngredientLine(i);
	return { amount: i.amount ?? "", unit: i.unit ?? "", name: i.name };
}

function byCreated<T extends { created_at?: string }>(a: Doc<T>, b: Doc<T>): number {
	return (a.data.created_at ?? "").localeCompare(b.data.created_at ?? "");
}

export class MiseData {
	private readonly root: string;

	constructor(
		private readonly db: Store,
		uid: string,
		/** Today's weekday in our time zone, e.g. "mon" or "sat". */
		private readonly todayKey: string,
		private readonly newId: () => string = () => crypto.randomUUID(),
		private readonly nowIso: () => string = () => new Date().toISOString(),
	) {
		this.root = `users/${uid}`;
	}

	// ── Reading ────────────────────────────────────────────────────────────

	private async collection<T>(name: string): Promise<(T & { id: string })[]> {
		const docs = await this.db.query<T & { created_at?: string }>(`${this.root}/${name}`, []);
		return docs.sort(byCreated).map((d) => ({ ...d.data, id: d.id }));
	}

	recipes(): Promise<Recipe[]> {
		return this.collection<Recipe>("recipes");
	}

	items(list: ListName): Promise<AnyItem[]> {
		return this.collection<AnyItem>(COLLECTION[list]);
	}

	async weekPlan(): Promise<WeekPlan> {
		return (await this.db.get<WeekPlan>(`${this.root}/app/week_plan`))?.data ?? {};
	}

	private async learned(): Promise<Record<string, GroceryCategory>> {
		return (await this.db.get<Record<string, GroceryCategory>>(`${this.root}/app/learned_categories`))?.data ?? {};
	}

	/** The app's guess, with categories someone corrected in the app winning. */
	private categorise(text: string, learned: Record<string, GroceryCategory>): GroceryCategory {
		return learned[text.trim().toLowerCase()] ?? categoriseItem(text);
	}

	private async recipe(id: string): Promise<Recipe> {
		const doc = await this.db.get<Recipe>(`${this.root}/recipes/${id}`);
		if (!doc) throw new NotFound(`No recipe with id ${id}. Use list_recipes to find it.`);
		return { ...doc.data, id: doc.id };
	}

	// ── Week plan ──────────────────────────────────────────────────────────

	async getWeekPlan() {
		const [plan, recipes, grocery] = await Promise.all([this.weekPlan(), this.recipes(), this.items("grocery")]);
		return {
			today: this.todayKey,
			note: "The plan is Monday to Friday dinners for the current week; it has no dates and carries over until changed.",
			days: WEEK_DAYS.map((day) => {
				const entry = plan[day];
				const recipe = entry?.recipeId ? recipes.find((r) => r.id === entry.recipeId) : undefined;
				return {
					day,
					label: WEEK_DAY_LABELS[day],
					meal: recipe?.title ?? entry?.label ?? null,
					recipe_id: recipe?.id ?? null,
					grocery_items: grocery
						.filter((i) => i.from_day === day)
						.map((i) => ({ id: i.id, text: i.text, checked: i.checked, from_recipe: Boolean(i.from_recipe_id) })),
				};
			}),
		};
	}

	/**
	 * Sets or clears one day, like typing in the app's day field: a recipe's
	 * ingredients go on the grocery list for that day, and the previous recipe's
	 * come off. Items added to the day by hand stay.
	 */
	async setMeal(day: WeekDay, meal: MealInput, addIngredients = true) {
		const [plan, grocery, learned] = await Promise.all([this.weekPlan(), this.items("grocery"), this.learned()]);
		const prev = plan[day];
		let entry: MealPlanEntry | undefined;
		let recipe: Recipe | undefined;

		if (meal && "recipe_id" in meal) {
			recipe = await this.recipe(meal.recipe_id);
		} else if (meal && "recipe_title" in meal) {
			const title = meal.recipe_title.trim().toLowerCase();
			recipe = (await this.recipes()).find((r) => r.title.trim().toLowerCase() === title);
			if (!recipe) throw new NotFound(`No recipe titled "${meal.recipe_title}". Use list_recipes, or set a label instead.`);
		} else if (meal && "label" in meal) {
			const label = meal.label.trim();
			// The app turns a label that matches a recipe title into that recipe.
			recipe = label ? (await this.recipes()).find((r) => r.title.toLowerCase() === label.toLowerCase()) : undefined;
			if (!recipe && label) entry = { label };
		}
		if (recipe) entry = { recipeId: recipe.id };

		const writes: Write[] = [];
		const sameRecipe = Boolean(recipe && prev?.recipeId === recipe.id);
		let removed = 0;
		let added: string[] = [];
		if (prev?.recipeId && !sameRecipe) {
			for (const item of grocery) {
				if (item.from_day === day && item.from_recipe_id) {
					writes.push({ kind: "delete", path: `${this.root}/grocery_list/${item.id}` });
					removed++;
				}
			}
		}
		if (recipe && !sameRecipe && addIngredients) {
			for (const ing of recipe.ingredients.filter((i) => i.name.trim())) {
				const id = this.newId();
				const item: GroceryItem = {
					id,
					text: itemText(ing),
					checked: false,
					from_recipe_id: recipe.id,
					from_day: day,
					category: this.categorise(ing.name, learned),
				};
				writes.push({ kind: "create", path: `${this.root}/grocery_list/${id}`, data: { ...item, created_at: id } });
				added.push(item.text);
			}
		}
		const next: WeekPlan = { ...plan };
		if (entry) next[day] = entry;
		else delete next[day];
		writes.push({ kind: "set", path: `${this.root}/app/week_plan`, data: next as Record<string, unknown> });
		await this.db.commit(writes);

		return {
			day,
			meal: recipe?.title ?? entry?.label ?? null,
			recipe_id: recipe?.id ?? null,
			grocery_items_added: added,
			grocery_items_removed: removed,
		};
	}

	/** Swaps two days' meals, and their grocery items follow, as dragging in the app does. */
	async swapMeals(a: WeekDay, b: WeekDay) {
		if (a === b) return this.getWeekPlan();
		const [plan, grocery] = await Promise.all([this.weekPlan(), this.items("grocery")]);
		const next: WeekPlan = { ...plan };
		delete next[a];
		delete next[b];
		if (plan[b]) next[a] = plan[b];
		if (plan[a]) next[b] = plan[a];
		const writes: Write[] = [{ kind: "set", path: `${this.root}/app/week_plan`, data: next as Record<string, unknown> }];
		for (const item of grocery) {
			if (item.from_day === a || item.from_day === b) {
				writes.push({
					kind: "update",
					path: `${this.root}/grocery_list/${item.id}`,
					data: { from_day: item.from_day === a ? b : a },
				});
			}
		}
		await this.db.commit(writes);
		return this.getWeekPlan();
	}

	// ── Lists ──────────────────────────────────────────────────────────────

	async getLists(lists: ListName[]) {
		const recipes = lists.includes("grocery") ? await this.recipes() : [];
		const titles = new Map(recipes.map((r) => [r.id, r.title]));
		const out: Record<string, unknown> = {};
		for (const list of lists) {
			const items = await this.items(list);
			const row = (i: AnyItem) => ({
				id: i.id,
				text: i.text,
				...(CHECKABLE.includes(list) ? { checked: Boolean(i.checked) } : {}),
				...(list === "grocery" && i.from_day ? { day: i.from_day } : {}),
				...(list === "grocery" && i.from_recipe_id ? { recipe: titles.get(i.from_recipe_id) ?? "(deleted recipe)" } : {}),
			});
			if (CATEGORISED.includes(list)) {
				out[list] = GROCERY_CATEGORIES.map((c) => ({
					category: c,
					label: GROCERY_CATEGORY_LABELS[c],
					items: items.filter((i) => (i.category ?? "other") === c).map(row),
				})).filter((g) => g.items.length > 0);
			} else {
				out[list] = items.map(row);
			}
		}
		return out;
	}

	async addItems(list: ListName, items: NewItem[]) {
		const learned = await this.learned();
		const existing = await this.items(list);
		const have = new Set(existing.filter((i) => !i.checked).map((i) => i.text.trim().toLowerCase()));
		const writes: Write[] = [];
		const added: { id: string; text: string; category?: GroceryCategory }[] = [];
		const skipped: string[] = [];
		for (const n of items) {
			const text = n.text.trim();
			if (!text) continue;
			// Don't add what's already on the list and not yet ticked (or already in supplies).
			if (have.has(text.toLowerCase())) {
				skipped.push(text);
				continue;
			}
			have.add(text.toLowerCase());
			const id = this.newId();
			const data: Record<string, unknown> = { id, text, created_at: id };
			if (CHECKABLE.includes(list)) data.checked = false;
			if (CATEGORISED.includes(list)) data.category = n.category ?? this.categorise(text, learned);
			if (list === "grocery" && n.day) data.from_day = n.day;
			writes.push({ kind: "create", path: `${this.root}/${COLLECTION[list]}/${id}`, data });
			added.push({ id, text, category: data.category as GroceryCategory | undefined });
		}
		if (writes.length) await this.db.commit(writes);
		return { list, added, skipped_already_listed: skipped };
	}

	async updateItem(list: ListName, id: string, changes: ItemChanges) {
		const path = `${this.root}/${COLLECTION[list]}/${id}`;
		const doc = await this.db.get<AnyItem>(path);
		if (!doc) throw new NotFound(`No ${list} item with id ${id}. Use get_lists to find it.`);
		const data: Record<string, unknown> = {};
		if (changes.text !== undefined) data.text = changes.text.trim();
		if (changes.checked !== undefined) {
			if (!CHECKABLE.includes(list)) throw new Error("Supplies items can't be ticked; remove them when they're used up.");
			data.checked = changes.checked;
		}
		if (changes.category !== undefined) {
			if (!CATEGORISED.includes(list)) throw new Error("Staples don't have categories.");
			data.category = changes.category;
		}
		if (changes.day !== undefined) {
			if (list !== "grocery") throw new Error("Only grocery items belong to a day.");
			data.from_day = changes.day;
		}
		const writes: Write[] = [{ kind: "update", path, data }];
		// Like the app, a corrected category is remembered for that item next time.
		if (changes.category && (list === "grocery" || list === "supplies")) {
			const key = String(data.text ?? doc.data.text).trim().toLowerCase();
			if (key) writes.push({ kind: "set", path: `${this.root}/app/learned_categories`, data: { [key]: changes.category }, merge: true });
		}
		await this.db.commit(writes);
		return { list, item: { ...doc.data, ...data, id } };
	}

	async removeItems(list: ListName, ids: string[]) {
		const items = await this.items(list);
		const found = items.filter((i) => ids.includes(i.id));
		const missing = ids.filter((id) => !found.some((i) => i.id === id));
		if (found.length) {
			await this.db.commit(found.map((i) => ({ kind: "delete", path: `${this.root}/${COLLECTION[list]}/${i.id}` }) as Write));
		}
		return { list, removed: found.map((i) => i.text), not_found: missing };
	}

	/** The app's "Clear checked": ticked grocery items go, ticked staples are unticked. */
	async clearChecked() {
		const [grocery, staples] = await Promise.all([this.items("grocery"), this.items("staples")]);
		const writes: Write[] = [];
		const removed = grocery.filter((i) => i.checked);
		for (const i of removed) writes.push({ kind: "delete", path: `${this.root}/grocery_list/${i.id}` });
		const unticked = staples.filter((s) => s.checked);
		for (const s of unticked) writes.push({ kind: "update", path: `${this.root}/staples/${s.id}`, data: { checked: false } });
		if (writes.length) await this.db.commit(writes);
		return { grocery_removed: removed.map((i) => i.text), staples_unticked: unticked.map((s) => s.text) };
	}

	// ── Recipes ────────────────────────────────────────────────────────────

	async listRecipes(query?: string) {
		const [recipes, supplies, plan] = await Promise.all([this.recipes(), this.items("supplies"), this.weekPlan()]);
		const keySupplies = supplies.filter((s) => isKeyIngredient(s.text, s.category));
		const q = query?.trim().toLowerCase();
		const matches = q
			? recipes.filter((r) =>
					[r.title, r.notes ?? "", ...r.ingredients.map((i) => i.name)].some((t) => t.toLowerCase().includes(q)),
				)
			: recipes;
		return matches.map((r) => ({
			id: r.id,
			title: r.title,
			servings: r.servings,
			key_ingredients: r.ingredients.filter((i) => isKeyIngredient(i.name)).map((i) => i.name),
			uses_supplies: matchKeySupplies(r, keySupplies).map((s) => s.text),
			planned_on: WEEK_DAYS.filter((d) => plan[d]?.recipeId === r.id),
			source_url: r.source_url ?? null,
		}));
	}

	async getRecipe(id: string) {
		return this.recipe(id);
	}

	async addRecipe(input: RecipeInput) {
		const existing = await this.recipes();
		const title = input.title.trim();
		const dupe = existing.find((r) => r.title.trim().toLowerCase() === title.toLowerCase());
		if (dupe) throw new Error(`There's already a recipe called "${dupe.title}" (id ${dupe.id}). Use update_recipe to change it.`);
		const id = this.newId();
		const recipe: Recipe = {
			id,
			title,
			servings: input.servings ?? 4,
			ingredients: (input.ingredients ?? []).map(toIngredient).filter((i) => i.name.trim()),
			steps: (input.steps ?? []).map((s) => s.trim()).filter(Boolean),
			notes: input.notes?.trim() || undefined,
			source_url: input.source_url || undefined,
			image: input.image || undefined,
			created_at: this.nowIso(),
		};
		await this.db.commit([{ kind: "create", path: `${this.root}/recipes/${id}`, data: recipe as unknown as Record<string, unknown> }]);
		return recipe;
	}

	async updateRecipe(id: string, changes: Partial<Omit<RecipeInput, "notes" | "source_url" | "image">> & {
		notes?: string | null;
		source_url?: string | null;
		image?: string | null;
	}) {
		const current = await this.recipe(id);
		const data: Record<string, unknown> = {};
		if (changes.title !== undefined) data.title = changes.title.trim();
		if (changes.servings !== undefined) data.servings = changes.servings;
		if (changes.ingredients !== undefined) data.ingredients = changes.ingredients.map(toIngredient).filter((i) => i.name.trim());
		if (changes.steps !== undefined) data.steps = changes.steps.map((s) => s.trim()).filter(Boolean);
		// null clears; the app treats an empty string as no value.
		for (const k of ["notes", "source_url", "image"] as const) {
			if (changes[k] !== undefined) data[k] = changes[k] ?? "";
		}
		if (Object.keys(data).length === 0) return current;
		await this.db.commit([{ kind: "update", path: `${this.root}/recipes/${id}`, data }]);
		return { ...current, ...data };
	}

	/** Deletes a recipe, and takes it off the week plan along with its grocery items. */
	async deleteRecipe(id: string) {
		const recipe = await this.recipe(id);
		const [plan, grocery] = await Promise.all([this.weekPlan(), this.items("grocery")]);
		const days = WEEK_DAYS.filter((d) => plan[d]?.recipeId === id);
		const writes: Write[] = [{ kind: "delete", path: `${this.root}/recipes/${id}` }];
		if (days.length) {
			const next: WeekPlan = { ...plan };
			for (const d of days) delete next[d];
			writes.push({ kind: "set", path: `${this.root}/app/week_plan`, data: next as Record<string, unknown> });
		}
		const items = grocery.filter((i) => i.from_recipe_id === id && !i.checked);
		for (const i of items) writes.push({ kind: "delete", path: `${this.root}/grocery_list/${i.id}` });
		await this.db.commit(writes);
		return { deleted: recipe.title, cleared_days: days, grocery_items_removed: items.length };
	}
}
