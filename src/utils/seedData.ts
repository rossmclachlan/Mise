import type { PantryItem, Recipe, Staple } from '../types';

const now = new Date().toISOString();

export const SEED_RECIPES: Recipe[] = [
  {
    id: crypto.randomUUID(),
    title: 'Spaghetti Aglio e Olio',
    source_url: 'https://www.bonappetit.com/recipe/spaghetti-aglio-e-olio',
    servings: 4,
    ingredients: [
      { amount: '400', unit: 'g', name: 'spaghetti' },
      { amount: '6', unit: 'cloves', name: 'garlic, thinly sliced' },
      { amount: '1/2', unit: 'cup', name: 'olive oil' },
      { amount: '1', unit: 'tsp', name: 'red pepper flakes' },
      { amount: '1/4', unit: 'cup', name: 'chopped fresh parsley' },
      { amount: '1/2', unit: 'cup', name: 'grated parmesan' },
      { amount: '', unit: '', name: 'salt, to taste' },
    ],
    steps: [
      'Bring a large pot of generously salted water to a boil and cook the spaghetti until al dente.',
      'While the pasta cooks, thinly slice the garlic cloves.',
      'Heat the olive oil in a large skillet over medium-low heat. Add the garlic and red pepper flakes.',
      'Cook gently for 4 minutes, stirring often, until the garlic is golden but not browned.',
      'Reserve 1 cup of pasta water, then drain the spaghetti.',
      'Add the spaghetti to the skillet and toss to coat, adding splashes of pasta water until glossy.',
      'Stir in the parsley and parmesan, season with salt, and serve immediately.',
    ],
    notes: "Don't let the garlic brown or it turns bitter.",
    created_at: now,
  },
  {
    id: crypto.randomUUID(),
    title: 'Veggie Stir Fry',
    servings: 2,
    ingredients: [
      { amount: '1', unit: 'tbsp', name: 'vegetable oil' },
      { amount: '2', unit: 'cloves', name: 'garlic, minced' },
      { amount: '1', unit: 'tbsp', name: 'fresh ginger, grated' },
      { amount: '1', unit: 'cup', name: 'broccoli florets' },
      { amount: '1', unit: '', name: 'red bell pepper, sliced' },
      { amount: '1', unit: '', name: 'carrot, julienned' },
      { amount: '2', unit: 'tbsp', name: 'soy sauce' },
      { amount: '1', unit: 'tsp', name: 'sesame oil' },
      { amount: '1', unit: 'tsp', name: 'cornstarch' },
      { amount: '2', unit: 'cups', name: 'cooked rice' },
    ],
    steps: [
      'Whisk the soy sauce, sesame oil, cornstarch and 2 tablespoons of water together in a small bowl.',
      'Heat the vegetable oil in a wok or large skillet over high heat.',
      'Add the garlic and ginger and stir-fry for 30 seconds until fragrant.',
      'Add the broccoli, bell pepper and carrot. Stir-fry for 4-5 minutes until crisp-tender.',
      'Pour in the sauce and toss to coat, cooking for 1 minute until it thickens slightly.',
      'Serve hot over the cooked rice.',
    ],
    created_at: now,
  },
  {
    id: crypto.randomUUID(),
    title: 'Classic Pancakes',
    source_url: 'https://www.allrecipes.com/recipe/21014/good-old-fashioned-pancakes/',
    servings: 4,
    ingredients: [
      { amount: '1 1/2', unit: 'cups', name: 'all-purpose flour' },
      { amount: '3 1/2', unit: 'tsp', name: 'baking powder' },
      { amount: '1', unit: 'tsp', name: 'salt' },
      { amount: '1', unit: 'tbsp', name: 'sugar' },
      { amount: '1 1/4', unit: 'cups', name: 'milk' },
      { amount: '1', unit: '', name: 'egg' },
      { amount: '3', unit: 'tbsp', name: 'melted butter' },
    ],
    steps: [
      'In a large bowl, sift together the flour, baking powder, salt and sugar.',
      "Whisk in the milk, egg and melted butter until just combined; don't overmix.",
      'Heat a lightly oiled griddle or frying pan over medium-high heat.',
      'Pour about 1/4 cup of batter onto the griddle for each pancake.',
      'Cook for 2-3 minutes until bubbles form and the edges look dry, then flip.',
      'Cook for another 1-2 minutes until golden brown on the other side.',
      'Serve warm with maple syrup.',
    ],
    notes: 'Let the batter rest for 5 minutes before cooking for fluffier pancakes.',
    created_at: now,
  },
];

export const SEED_STAPLES: Staple[] = [
  { id: crypto.randomUUID(), text: 'Eggs', checked: false },
  { id: crypto.randomUUID(), text: 'Milk', checked: false },
  { id: crypto.randomUUID(), text: 'Butter', checked: false },
  { id: crypto.randomUUID(), text: 'Olive oil', checked: false },
  { id: crypto.randomUUID(), text: 'Salt', checked: false },
  { id: crypto.randomUUID(), text: 'Garlic', checked: false },
];

export const SEED_PANTRY: PantryItem[] = [
  { id: crypto.randomUUID(), text: 'Olive oil' },
  { id: crypto.randomUUID(), text: 'Salt' },
  { id: crypto.randomUUID(), text: 'Garlic' },
  { id: crypto.randomUUID(), text: 'Black pepper' },
  { id: crypto.randomUUID(), text: 'Rice' },
];
