// Runs MiseData against an in-memory stand-in for Firestore: npm test (in mise-mcp/).
import { beforeEach, describe, expect, it } from "vitest";
import type { Doc, Write } from "../../mcp-worker/src/firestore";
import { MiseData, type Store } from "../src/mise";

class MemoryStore implements Store {
	docs = new Map<string, Record<string, unknown>>();

	async get<T>(path: string): Promise<Doc<T> | null> {
		const data = this.docs.get(path);
		return data ? { id: path.split("/").pop()!, data: structuredClone(data) as T } : null;
	}

	async query<T>(collectionPath: string): Promise<Doc<T>[]> {
		const depth = collectionPath.split("/").length + 1;
		return [...this.docs.entries()]
			.filter(([p]) => p.startsWith(`${collectionPath}/`) && p.split("/").length === depth)
			.map(([p, data]) => ({ id: p.split("/").pop()!, data: structuredClone(data) as T }));
	}

	async commit(writes: Write[]): Promise<void> {
		const next = new Map(this.docs);
		for (const w of writes) {
			const clean = (d: Record<string, unknown>) => JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
			if (w.kind === "delete") next.delete(w.path);
			else if (w.kind === "create") {
				if (next.has(w.path)) throw new Error(`exists: ${w.path}`);
				next.set(w.path, clean(w.data));
			} else if (w.kind === "update") {
				if (!next.has(w.path)) throw new Error(`missing: ${w.path}`);
				next.set(w.path, { ...next.get(w.path), ...clean(w.data) });
			} else {
				next.set(w.path, w.merge ? { ...(next.get(w.path) ?? {}), ...clean(w.data) } : clean(w.data));
			}
		}
		this.docs = next;
	}
}

const U = "users/mise";
let store: MemoryStore;
let n: number;
const mise = () => new MiseData(store, "mise", "wed", () => `id${String(++n).padStart(3, "0")}`, () => "2026-10-09T00:00:00.000Z");

beforeEach(async () => {
	store = new MemoryStore();
	n = 0;
	await mise().addRecipe({
		title: "Tacos",
		servings: 4,
		ingredients: ["1 lb ground beef", "8 tortillas", "1 lime", { name: "salt" }],
		steps: ["Brown the beef.", "Warm the tortillas."],
	});
	await mise().addRecipe({ title: "Salmon bowls", ingredients: ["2 salmon fillets", "1 cup rice"] });
});

const recipeId = async (title: string) => (await mise().recipes()).find((r) => r.title === title)!.id;

describe("MiseData", () => {
	it("parses ingredient lines into amount, unit and name", async () => {
		const tacos = await mise().getRecipe(await recipeId("Tacos"));
		expect(tacos.ingredients[0]).toEqual({ amount: "1", unit: "lb", name: "ground beef" });
		expect(tacos.ingredients[3]).toEqual({ amount: "", unit: "", name: "salt" });
		await expect(mise().addRecipe({ title: "tacos" })).rejects.toThrow(/already a recipe/);
	});

	it("planning a recipe adds its ingredients for that day, and replacing it takes them off", async () => {
		const r = await mise().setMeal("mon", { recipe_title: "Tacos" });
		expect(r.grocery_items_added).toEqual(["1 lb ground beef", "8 tortillas", "1 lime", "salt"]);
		await mise().addItems("grocery", [{ text: "sour cream", day: "mon" }]);

		const plan = await mise().getWeekPlan();
		expect(plan.days[0]).toMatchObject({ day: "mon", meal: "Tacos" });
		expect(plan.days[0].grocery_items).toHaveLength(5);

		const lists = (await mise().getLists(["grocery"])) as { grocery: { category: string; items: { text: string; recipe?: string }[] }[] };
		const meat = lists.grocery.find((g) => g.category === "meat")!;
		expect(meat.items[0]).toMatchObject({ text: "1 lb ground beef", recipe: "Tacos" });

		const r2 = await mise().setMeal("mon", { label: "Leftovers" });
		expect(r2.grocery_items_removed).toBe(4);
		const after = await mise().getWeekPlan();
		expect(after.days[0].meal).toBe("Leftovers");
		// The hand-added item stays with the day.
		expect(after.days[0].grocery_items.map((i) => i.text)).toEqual(["sour cream"]);

		await mise().setMeal("mon", null);
		expect((await mise().weekPlan()).mon).toBeUndefined();
	});

	it("a label matching a recipe title plans that recipe, like the app", async () => {
		const r = await mise().setMeal("tue", { label: "salmon bowls" });
		expect(r.recipe_id).toBe(await recipeId("Salmon bowls"));
	});

	it("swapping days moves the grocery items with the meals", async () => {
		await mise().setMeal("mon", { recipe_title: "Tacos" });
		await mise().setMeal("thu", { label: "Pizza" });
		const plan = await mise().swapMeals("mon", "thu");
		expect(plan.days[0].meal).toBe("Pizza");
		expect(plan.days[3].meal).toBe("Tacos");
		expect(plan.days[3].grocery_items).toHaveLength(4);
		expect(plan.days[0].grocery_items).toHaveLength(0);
	});

	it("adds, skips duplicates, ticks and clears checked", async () => {
		const a = await mise().addItems("grocery", [{ text: "Oat milk" }, { text: "oat milk" }]);
		expect(a.added).toHaveLength(1);
		expect(a.skipped_already_listed).toEqual(["oat milk"]);
		const s = await mise().addItems("staples", [{ text: "Bread" }]);
		await mise().updateItem("grocery", a.added[0].id, { checked: true });
		await mise().updateItem("staples", s.added[0].id, { checked: true });
		const c = await mise().clearChecked();
		expect(c).toEqual({ grocery_removed: ["Oat milk"], staples_unticked: ["Bread"] });
		expect(store.docs.get(`${U}/staples/${s.added[0].id}`)?.checked).toBe(false);
	});

	it("remembers a corrected category, and uses it for the next item", async () => {
		const a = await mise().addItems("supplies", [{ text: "Tofu" }]);
		await mise().updateItem("supplies", a.added[0].id, { category: "dairy" });
		expect(store.docs.get(`${U}/app/learned_categories`)).toEqual({ tofu: "dairy" });
		const b = await mise().addItems("grocery", [{ text: "tofu" }]);
		expect(b.added[0].category).toBe("dairy");
		await expect(mise().updateItem("supplies", a.added[0].id, { checked: true })).rejects.toThrow(/can't be ticked/);
	});

	it("lists recipes with the key supplies they'd use", async () => {
		await mise().addItems("supplies", [{ text: "salmon" }, { text: "salt" }]);
		const rows = await mise().listRecipes();
		const bowls = rows.find((r) => r.title === "Salmon bowls")!;
		expect(bowls.uses_supplies).toEqual(["salmon"]);
		expect(rows.find((r) => r.title === "Tacos")!.uses_supplies).toEqual([]);
		expect((await mise().listRecipes("tortilla")).map((r) => r.title)).toEqual(["Tacos"]);
	});

	it("deleting a planned recipe clears its days and grocery items", async () => {
		await mise().setMeal("wed", { recipe_title: "Tacos" });
		const r = await mise().deleteRecipe(await recipeId("Tacos"));
		expect(r).toMatchObject({ deleted: "Tacos", cleared_days: ["wed"], grocery_items_removed: 4 });
		expect(await mise().weekPlan()).toEqual({});
	});

	it("updates a recipe and clears a field with null", async () => {
		const id = await recipeId("Tacos");
		await mise().updateRecipe(id, { notes: "Spicy", servings: 6 });
		const r = await mise().updateRecipe(id, { notes: null, ingredients: ["2 avocados"] });
		expect(r).toMatchObject({ notes: "", servings: 6, ingredients: [{ amount: "2", unit: "", name: "avocados" }] });
	});
});
