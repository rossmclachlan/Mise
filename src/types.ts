export type Mode = 'plan' | 'shop' | 'cook';

export interface Ingredient {
  amount: string;
  unit: string;
  name: string;
}

export interface Recipe {
  id: string;
  title: string;
  source_url?: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
  created_at: string;
}

export interface GroceryItem {
  id: string;
  text: string;
  checked: boolean;
  from_recipe_id?: string;
}

export interface Staple {
  id: string;
  text: string;
  checked: boolean;
}

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export const WEEK_DAYS: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
};

export type MealPlanEntry =
  | { type: 'recipe'; recipeId: string }
  | { type: 'idea'; text: string }
  | { type: 'skip' };

export type WeekPlan = Partial<Record<WeekDay, MealPlanEntry>>;
