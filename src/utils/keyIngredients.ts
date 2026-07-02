import type { GroceryCategory, Recipe, SupplyItem } from '../types';
import { categoriseItem } from './categorise';

// A "key" ingredient is one worth planning a meal around — a protein, a carb
// base, a hero vegetable — as opposed to incidentals (seasonings, fats,
// condiments, aromatics) that appear in nearly every recipe and say nothing
// about what to cook. Key-ness is judged per grocery category, with keyword
// refinements where a category mixes both kinds.

// Aromatics, herbs and citrus read as seasoning, not the star of a meal.
const INCIDENTAL_PRODUCE = [
  'garlic',
  'onion',
  'shallot',
  'ginger',
  'chili',
  'lemon',
  'lime',
  'herb',
  'parsley',
  'cilantro',
  'basil',
  'thyme',
  'rosemary',
  'mint',
  'dill',
];

// Cooking dairy rather than meal-defining dairy (cheese, eggs stay key).
const INCIDENTAL_DAIRY = ['milk', 'butter', 'cream', 'creme fraiche'];

// The pantry category is mostly seasonings and condiments, so it's opt-in:
// only carb and protein bases count as key.
const KEY_PANTRY = [
  'pasta',
  'spaghetti',
  'noodle',
  'rice',
  'lentil',
  'chickpea',
  'bean',
  'quinoa',
  'couscous',
  'gnocchi',
  'polenta',
  'barley',
  'orzo',
];

export function isKeyIngredient(text: string, category?: GroceryCategory): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;

  switch (category ?? categoriseItem(t)) {
    case 'meat':
    case 'fish':
    case 'frozen':
    case 'bakery':
      return true;
    case 'produce':
      return !INCIDENTAL_PRODUCE.some((k) => t.includes(k));
    case 'dairy':
      return !INCIDENTAL_DAIRY.some((k) => t.includes(k));
    case 'pantry':
      return KEY_PANTRY.some((k) => t.includes(k));
    case 'drinks':
      return false;
    default:
      // Unknown items are usually real foods — the seasoning space is well
      // covered by the categorisation dictionary.
      return true;
  }
}

/** The key supply items a recipe's ingredient list would use. */
export function matchKeySupplies(recipe: Recipe, keySupplies: SupplyItem[]): SupplyItem[] {
  return keySupplies.filter((supply) => {
    const t = supply.text.trim().toLowerCase();
    return t && recipe.ingredients.some((ing) => ing.name.toLowerCase().includes(t));
  });
}
