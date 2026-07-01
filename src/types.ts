export type Mode = 'plan' | 'grocery' | 'cook';

export interface Ingredient {
  amount: string;
  unit: string;
  name: string;
}

export interface Recipe {
  id: string;
  title: string;
  source_url?: string;
  image?: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
  created_at: string;
}

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export type GroceryCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'fish'
  | 'bakery'
  | 'pantry'
  | 'frozen'
  | 'drinks'
  | 'other';

export const GROCERY_CATEGORIES: GroceryCategory[] = [
  'produce',
  'dairy',
  'meat',
  'fish',
  'bakery',
  'pantry',
  'frozen',
  'drinks',
  'other',
];

export const GROCERY_CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: 'Produce',
  dairy: 'Dairy & Eggs',
  meat: 'Meat',
  fish: 'Fish & Seafood',
  bakery: 'Bakery',
  pantry: 'Pantry',
  frozen: 'Frozen',
  drinks: 'Drinks',
  other: 'Other',
};

export interface GroceryItem {
  id: string;
  text: string;
  checked: boolean;
  from_recipe_id?: string;
  from_day?: WeekDay;
  category?: GroceryCategory;
}

export interface Staple {
  id: string;
  text: string;
  checked: boolean;
}

export interface CostcoItem {
  id: string;
  text: string;
  checked: boolean;
  category?: GroceryCategory;
}

/**
 * A supplies (at-home inventory) item. Categorised with the same
 * GroceryCategory taxonomy as the grocery list so the two display and sort
 * under a shared set of headings.
 */
export interface SupplyItem {
  id: string;
  text: string;
  category?: GroceryCategory;
}

export const WEEK_DAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
};

export interface MealPlanEntry {
  /** Reference to a recipe in the recipe box. */
  recipeId?: string;
  /** Free-text meal idea, used when no recipe is selected. */
  label?: string;
}

export type WeekPlan = Partial<Record<WeekDay, MealPlanEntry>>;
