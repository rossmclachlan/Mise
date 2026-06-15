import type { GroceryCategory } from '../types';

export const CATEGORY_MAP: Record<string, GroceryCategory> = {
  // Produce
  apple: 'produce',
  banana: 'produce',
  lemon: 'produce',
  lime: 'produce',
  orange: 'produce',
  tomato: 'produce',
  garlic: 'produce',
  onion: 'produce',
  shallot: 'produce',
  carrot: 'produce',
  celery: 'produce',
  spinach: 'produce',
  kale: 'produce',
  lettuce: 'produce',
  arugula: 'produce',
  cucumber: 'produce',
  zucchini: 'produce',
  courgette: 'produce',
  chili: 'produce',
  potato: 'produce',
  'sweet potato': 'produce',
  mushroom: 'produce',
  ginger: 'produce',
  herb: 'produce',
  parsley: 'produce',
  cilantro: 'produce',
  basil: 'produce',
  thyme: 'produce',
  rosemary: 'produce',
  mint: 'produce',
  dill: 'produce',
  avocado: 'produce',
  broccoli: 'produce',
  cauliflower: 'produce',
  asparagus: 'produce',
  leek: 'produce',
  fennel: 'produce',
  beetroot: 'produce',
  radish: 'produce',
  corn: 'produce',
  pea: 'produce',
  bean: 'produce',
  edamame: 'produce',
  'bell pepper': 'produce',
  'red pepper': 'produce',
  'green pepper': 'produce',

  // Dairy & eggs
  milk: 'dairy',
  butter: 'dairy',
  cream: 'dairy',
  yogurt: 'dairy',
  yoghurt: 'dairy',
  cheese: 'dairy',
  cheddar: 'dairy',
  parmesan: 'dairy',
  mozzarella: 'dairy',
  feta: 'dairy',
  ricotta: 'dairy',
  brie: 'dairy',
  halloumi: 'dairy',
  egg: 'dairy',
  'sour cream': 'dairy',
  'cream cheese': 'dairy',
  'creme fraiche': 'dairy',
  'oat milk': 'dairy',
  'almond milk': 'dairy',
  'coconut milk': 'dairy',

  // Meat
  chicken: 'meat',
  beef: 'meat',
  pork: 'meat',
  lamb: 'meat',
  turkey: 'meat',
  bacon: 'meat',
  sausage: 'meat',
  salami: 'meat',
  pancetta: 'meat',
  prosciutto: 'meat',
  chorizo: 'meat',
  mince: 'meat',
  steak: 'meat',
  brisket: 'meat',
  ribs: 'meat',
  duck: 'meat',
  veal: 'meat',

  // Fish & seafood
  salmon: 'fish',
  tuna: 'fish',
  cod: 'fish',
  halibut: 'fish',
  'sea bass': 'fish',
  shrimp: 'fish',
  prawn: 'fish',
  scallop: 'fish',
  crab: 'fish',
  lobster: 'fish',
  anchovy: 'fish',
  sardine: 'fish',
  mackerel: 'fish',
  mussels: 'fish',
  clam: 'fish',
  squid: 'fish',
  octopus: 'fish',

  // Bakery
  bread: 'bakery',
  sourdough: 'bakery',
  baguette: 'bakery',
  roll: 'bakery',
  bagel: 'bakery',
  pita: 'bakery',
  tortilla: 'bakery',
  wrap: 'bakery',
  croissant: 'bakery',
  muffin: 'bakery',
  cake: 'bakery',

  // Pantry
  flour: 'pantry',
  sugar: 'pantry',
  salt: 'pantry',
  pepper: 'pantry',
  oil: 'pantry',
  'olive oil': 'pantry',
  vinegar: 'pantry',
  soy: 'pantry',
  pasta: 'pantry',
  spaghetti: 'pantry',
  rice: 'pantry',
  noodle: 'pantry',
  lentil: 'pantry',
  chickpea: 'pantry',
  'black bean': 'pantry',
  'kidney bean': 'pantry',
  stock: 'pantry',
  broth: 'pantry',
  'tomato paste': 'pantry',
  'tomato sauce': 'pantry',
  'coconut cream': 'pantry',
  honey: 'pantry',
  maple: 'pantry',
  jam: 'pantry',
  mustard: 'pantry',
  ketchup: 'pantry',
  mayo: 'pantry',
  tahini: 'pantry',
  miso: 'pantry',
  'fish sauce': 'pantry',
  'hot sauce': 'pantry',
  cumin: 'pantry',
  paprika: 'pantry',
  turmeric: 'pantry',
  cinnamon: 'pantry',
  oregano: 'pantry',
  'bay leaf': 'pantry',
  'chili flake': 'pantry',
  'red pepper flake': 'pantry',
  'baking powder': 'pantry',
  'baking soda': 'pantry',
  cornstarch: 'pantry',
  oat: 'pantry',
  granola: 'pantry',
  cereal: 'pantry',
  cracker: 'pantry',
  nut: 'pantry',
  almond: 'pantry',
  walnut: 'pantry',
  cashew: 'pantry',
  'pine nut': 'pantry',
  seed: 'pantry',

  // Frozen
  'ice cream': 'frozen',
  'frozen pea': 'frozen',
  'frozen corn': 'frozen',
  'frozen berry': 'frozen',
  'fish finger': 'frozen',
  'frozen pizza': 'frozen',

  // Drinks
  juice: 'drinks',
  coffee: 'drinks',
  tea: 'drinks',
  wine: 'drinks',
  beer: 'drinks',
  water: 'drinks',
  soda: 'drinks',
  sparkling: 'drinks',
  kombucha: 'drinks',
};

const LEARNED_CATEGORIES_KEY = 'learned_categories';

export function getLearnedCategories(): Record<string, GroceryCategory> {
  try {
    const stored = localStorage.getItem(LEARNED_CATEGORIES_KEY);
    return stored ? (JSON.parse(stored) as Record<string, GroceryCategory>) : {};
  } catch {
    return {};
  }
}

export function learnCategory(name: string, category: GroceryCategory): void {
  const text = name.trim().toLowerCase();
  if (!text) return;
  const learned = getLearnedCategories();
  learned[text] = category;
  try {
    localStorage.setItem(LEARNED_CATEGORIES_KEY, JSON.stringify(learned));
  } catch {
    // ignore write failures (e.g. storage full or unavailable)
  }
}

/**
 * Guesses a grocery category for an item name. A learned (user-corrected)
 * category for the exact name wins over the base dictionary; otherwise the
 * longest matching dictionary entry (in either substring direction) is used.
 */
export function categoriseItem(name: string): GroceryCategory {
  const text = name.trim().toLowerCase();
  if (!text) return 'other';

  const learned = getLearnedCategories();
  if (learned[text]) return learned[text];

  if (CATEGORY_MAP[text]) return CATEGORY_MAP[text];

  let best: { key: string; category: GroceryCategory } | null = null;
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (text.includes(key) || key.includes(text)) {
      if (!best || key.length > best.key.length) {
        best = { key, category };
      }
    }
  }

  return best?.category ?? 'other';
}
