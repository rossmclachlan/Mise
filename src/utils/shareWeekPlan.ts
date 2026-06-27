import { WEEK_DAYS, WEEK_DAY_LABELS } from '../types';
import type { Recipe, WeekPlan } from '../types';

export function formatWeekPlanText(weekPlan: WeekPlan, recipes: Recipe[]): string {
  const lines = WEEK_DAYS.map((day) => {
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
  });

  return `This week's meal plan 🍽️\n\n${lines.join('\n')}`;
}
