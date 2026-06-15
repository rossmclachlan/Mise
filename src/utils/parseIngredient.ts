import type { Ingredient } from '../types';

// Ordered roughly longest/most-specific first so the `\b` boundary check
// after matching disambiguates prefixes like "tbsp" vs "tbs".
const UNIT_WORDS = [
  'tablespoons', 'tablespoon', 'tbsps', 'tbsp', 'tbs',
  'teaspoons', 'teaspoon', 'tsps', 'tsp',
  'fluid ounces', 'fluid ounce', 'fl oz',
  'ounces', 'ounce', 'oz',
  'pounds', 'pound', 'lbs', 'lb',
  'kilograms', 'kilogram', 'kgs', 'kg',
  'grams', 'gram', 'g',
  'milliliters', 'milliliter', 'millilitres', 'millilitre', 'ml',
  'liters', 'liter', 'litres', 'litre', 'l',
  'quarts', 'quart', 'qts', 'qt',
  'pints', 'pint', 'pts', 'pt',
  'gallons', 'gallon', 'gal',
  'cups', 'cup', 'c',
  'pinches', 'pinch',
  'dashes', 'dash',
  'cloves', 'clove',
  'cans', 'can',
  'jars', 'jar',
  'packages', 'package', 'packets', 'packet', 'pkgs', 'pkg',
  'bunches', 'bunch',
  'slices', 'slice',
  'sticks', 'stick',
  'heads', 'head',
  'sprigs', 'sprig',
  'stalks', 'stalk',
];

// Unicode vulgar fractions -> ascii equivalents, e.g. "½" -> "1/2"
const UNICODE_FRACTIONS: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

const UNIT_REGEX = new RegExp(
  `^(${UNIT_WORDS.join('|')})\\.?\\b\\s*`,
  'i',
);

// Mixed number ("1 1/2"), simple fraction ("1/2"), decimal ("0.5") or integer ("2")
const AMOUNT_REGEX = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s*/;

/**
 * Best-effort parse of a raw ingredient line into amount/unit/name.
 * Falls back to putting the entire line in `name` when no leading
 * quantity can be identified.
 */
export function parseIngredientLine(line: string): Ingredient {
  let text = line.trim().replace(/^[-*•]\s*/, '');

  for (const [unicode, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    text = text.split(unicode).join(` ${ascii}`);
  }
  text = text.replace(/\s+/g, ' ').trim();

  if (!text) return { amount: '', unit: '', name: '' };

  const amountMatch = text.match(AMOUNT_REGEX);
  if (!amountMatch) {
    return { amount: '', unit: '', name: text };
  }

  const amount = amountMatch[1].trim();
  let rest = text.slice(amountMatch[0].length).trim();

  let unit = '';
  const unitMatch = rest.match(UNIT_REGEX);
  if (unitMatch) {
    unit = unitMatch[1].toLowerCase();
    rest = rest.slice(unitMatch[0].length).trim();
  }

  rest = rest.replace(/^of\s+/i, '').trim();

  if (!rest) {
    return { amount: '', unit: '', name: text };
  }

  return { amount, unit, name: rest };
}
