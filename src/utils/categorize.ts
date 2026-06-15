import type { GroceryCategory } from '../types';

const KEYWORD_CATEGORIES: [GroceryCategory, string[]][] = [
  [
    'produce',
    [
      'lettuce', 'spinach', 'kale', 'arugula', 'tomato', 'onion', 'garlic',
      'pepper', 'bell pepper', 'carrot', 'celery', 'cucumber', 'potato',
      'broccoli', 'cauliflower', 'zucchini', 'mushroom', 'avocado', 'lemon',
      'lime', 'apple', 'banana', 'berry', 'berries', 'grape', 'orange',
      'ginger', 'parsley', 'cilantro', 'basil', 'mint', 'scallion',
      'shallot', 'leek', 'cabbage', 'corn', 'squash', 'herbs', 'fruit',
      'vegetable', 'asparagus', 'green bean',
    ],
  ],
  [
    'dairy',
    [
      'milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'parmesan',
      'mozzarella', 'cheddar', 'feta', 'egg', 'sour cream', 'half and half',
    ],
  ],
  [
    'meat',
    [
      'chicken', 'beef', 'pork', 'turkey', 'lamb', 'bacon', 'sausage',
      'ground beef', 'steak', 'ham', 'mince', 'meatball',
    ],
  ],
  [
    'fish',
    [
      'salmon', 'tuna', 'shrimp', 'prawn', 'cod', 'tilapia', 'fish',
      'anchovy', 'anchovies', 'crab', 'mussel', 'clam', 'scallop',
    ],
  ],
  [
    'bakery',
    [
      'bread', 'bun', 'roll', 'bagel', 'tortilla', 'baguette', 'croissant',
      'pita', 'naan', 'muffin', 'pastry',
    ],
  ],
  [
    'frozen',
    ['frozen', 'ice cream', 'popsicle'],
  ],
  [
    'drinks',
    [
      'juice', 'soda', 'water', 'wine', 'beer', 'coffee', 'tea', 'cola',
      'lemonade', 'kombucha',
    ],
  ],
  [
    'pantry',
    [
      'flour', 'sugar', 'salt', 'oil', 'vinegar', 'rice', 'pasta', 'spaghetti',
      'noodle', 'bean', 'lentil', 'can', 'sauce', 'spice', 'cumin',
      'paprika', 'cinnamon', 'oat', 'cereal', 'stock', 'broth', 'honey',
      'syrup', 'nut', 'almond', 'peanut', 'cornstarch', 'baking powder',
      'baking soda', 'yeast', 'chocolate', 'cocoa', 'vanilla', 'tomato paste',
      'soy sauce',
    ],
  ],
];

/** Best-effort guess at a grocery category from an ingredient name. */
export function guessCategory(name: string): GroceryCategory {
  const lower = name.toLowerCase();

  for (const [category, keywords] of KEYWORD_CATEGORIES) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }

  return 'other';
}
