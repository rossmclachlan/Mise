import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { looksLikeUrl, parseRecipeText } from './parseRecipeText';

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');

describe('looksLikeUrl', () => {
  it('spots links', () => {
    expect(looksLikeUrl('https://cooking.nytimes.com/recipes/1023')).toBe(true);
    expect(looksLikeUrl('www.bbcgoodfood.com/recipes/x')).toBe(true);
    expect(looksLikeUrl('smittenkitchen.com/2020/01/soup/')).toBe(true);
  });
  it('treats text as text', () => {
    expect(looksLikeUrl('Tomato soup\nIngredients\n1 can tomatoes')).toBe(false);
    expect(looksLikeUrl('soup')).toBe(false);
  });
});

describe('parseRecipeText', () => {
  it('reads a NYT Cooking page pasted whole', () => {
    const r = parseRecipeText(fixture('nyt-paste.txt'));
    expect(r.title).toBe('Crispy Gnocchi With Burst Tomatoes and Mozzarella');
    expect(r.servings).toBe(4);
    expect(r.notes).toMatch(/^This one-skillet dinner/);
    expect(r.ingredients.map((i) => [i.amount, i.unit, i.name])).toEqual([
      ['1', '', '(16- to 18-ounce) package shelf-stable or frozen gnocchi'],
      ['1/4', 'cup', 'extra-virgin olive oil'],
      ['2', 'pints', 'cherry or grape tomatoes'],
      ['4', '', 'garlic cloves, thinly sliced'],
      ['', '', 'Salt and black pepper'],
      ['1/2', 'teaspoon', 'red-pepper flakes'],
      ['8', 'ounces', 'fresh mozzarella, torn into bite-size pieces'],
      ['', '', 'Fresh basil leaves'],
    ]);
    expect(r.steps).toHaveLength(3);
    expect(r.steps[0]).toMatch(/^In a large \(12-inch\) nonstick skillet/);
    expect(r.steps[2]).toMatch(/until the tomatoes burst\.$/);
  });

  it('reads a blog recipe with sub-headings and numbered steps', () => {
    const r = parseRecipeText(fixture('blog-paste.txt'));
    expect(r.title).toBe('Weeknight Chicken Tacos');
    expect(r.servings).toBe(6);
    expect(r.ingredients.map((i) => i.name)).toEqual([
      'chicken thighs', 'olive oil', 'cumin', 'tomatoes, diced', 'red onion',
    ]);
    expect(r.steps).toEqual([
      'Season the chicken with cumin and salt.',
      'Heat the oil and cook the chicken for 6 minutes per side.',
      'Slice and serve in warm tortillas with the salsa.',
    ]);
  });

  it('guesses when there are no headings', () => {
    const r = parseRecipeText(
      'Quick Pesto\n2 cups basil\n1/2 cup parmesan\n1/3 cup olive oil\nBlend everything in a food processor until smooth, then season to taste with salt.',
    );
    expect(r.title).toBe('Quick Pesto');
    expect(r.ingredients).toHaveLength(3);
    expect(r.steps).toHaveLength(1);
  });

  it('rejects text with no recipe in it', () => {
    expect(() => parseRecipeText('hello there')).toThrow();
  });
});
