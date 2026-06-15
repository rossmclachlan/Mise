export type Mode = 'plan' | 'shop' | 'cook';

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
  name: string;
  amount?: string;
  unit?: string;
  category: GroceryCategory;
  checked: boolean;
  from_recipe_id?: string;
}

export interface Staple {
  id: string;
  name: string;
  amount?: string;
  unit?: string;
  category: GroceryCategory;
}

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

export const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat',
  fish: 'Fish',
  bakery: 'Bakery',
  pantry: 'Pantry',
  frozen: 'Frozen',
  drinks: 'Drinks',
  other: 'Other',
};
