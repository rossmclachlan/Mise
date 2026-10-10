import { describe, expect, it } from 'vitest';
import { formatWeekPlanText } from './shareWeekPlan';
import type { GroceryItem, Recipe } from '../types';

const recipe: Recipe = {
  id: 'r1',
  title: 'Chili',
  source_url: 'https://example.com/chili',
  servings: 4,
  ingredients: [],
  steps: [],
  created_at: '2026-01-01',
};

const item = (text: string, extra: Partial<GroceryItem>): GroceryItem => ({
  id: text,
  text,
  checked: false,
  ...extra,
});

describe('formatWeekPlanText', () => {
  it('lists items added to a meal under it, but not recipe ingredients', () => {
    const text = formatWeekPlanText(
      { mon: { recipeId: 'r1' }, tue: { label: 'Tacos' } },
      [recipe],
      [
        item('beans', { from_day: 'mon', from_recipe_id: 'r1' }),
        item('cornbread', { from_day: 'mon' }),
        item('tortillas', { from_day: 'tue' }),
        item('avocado', { from_day: 'tue' }),
        item('milk', {}),
        item('stray', { from_day: 'wed' }),
      ],
    );
    expect(text).toBe(
      [
        "This week's meal plan 🍽️",
        '',
        'Monday: Chili — https://example.com/chili',
        '   • cornbread',
        'Tuesday: Tacos',
        '   • tortillas',
        '   • avocado',
        'Wednesday: —',
        'Thursday: —',
        'Friday: —',
      ].join('\n'),
    );
  });
});
