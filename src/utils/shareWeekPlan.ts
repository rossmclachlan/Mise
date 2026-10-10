import { WEEK_DAYS, WEEK_DAY_LABELS } from '../types';
import type { GroceryItem, Recipe, WeekDay, WeekPlan } from '../types';

function mealLine(day: WeekDay, weekPlan: WeekPlan, recipes: Recipe[]): string {
  const label = WEEK_DAY_LABELS[day];
  const entry = weekPlan[day];
  if (!entry) return `${label}: —`;

  if (entry.recipeId) {
    const recipe = recipes.find((r) => r.id === entry.recipeId);
    if (!recipe) return `${label}: —`;
    return recipe.source_url
      ? `${label}: ${recipe.title} — ${recipe.source_url}`
      : `${label}: ${recipe.title}`;
  }

  return `${label}: ${entry.label}`;
}

/**
 * The week's dinners as plain text for the share sheet. Items added to a meal
 * by hand are listed under it; a recipe's own ingredients are left out, since
 * the recipe link already carries them.
 */
export function formatWeekPlanText(
  weekPlan: WeekPlan,
  recipes: Recipe[],
  groceryList: GroceryItem[] = [],
): string {
  const lines = WEEK_DAYS.flatMap((day) => {
    const subItems = weekPlan[day]
      ? groceryList.filter((item) => item.from_day === day && !item.from_recipe_id)
      : [];
    return [mealLine(day, weekPlan, recipes), ...subItems.map((item) => `   • ${item.text}`)];
  });

  return `This week's meal plan 🍽️\n\n${lines.join('\n')}`;
}
