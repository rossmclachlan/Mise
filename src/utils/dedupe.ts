import type { GroceryItem, Staple } from '../types';

/**
 * Appends staples to the grocery list, skipping any staple whose name
 * (case-insensitive, trimmed) already matches an existing item.
 */
export function mergeStaplesIntoGroceryList(
  groceryList: GroceryItem[],
  staples: Staple[],
): GroceryItem[] {
  const existingNames = new Set(
    groceryList.map((item) => item.name.trim().toLowerCase()),
  );

  const additions: GroceryItem[] = [];
  for (const staple of staples) {
    const key = staple.name.trim().toLowerCase();
    if (!key || existingNames.has(key)) continue;
    existingNames.add(key);
    additions.push({
      id: crypto.randomUUID(),
      name: staple.name,
      amount: staple.amount,
      unit: staple.unit,
      category: staple.category,
      checked: false,
    });
  }

  return [...groceryList, ...additions];
}
