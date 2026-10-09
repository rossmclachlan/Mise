import { ImportError, type ImportedRecipe } from './importRecipe';
import { parseIngredientLine } from './parseIngredient';

// Turns a block of recipe text copied straight off a web page (NYT Cooking,
// a blog, an email) into a recipe. It leans on the "Ingredients" and
// "Preparation"/"Method"/… headings most pages have, and falls back to
// guessing from the shape of each line when there are none. Whatever it
// produces lands in the editable form, so close enough is good enough.

/** True when the import box holds a link rather than pasted recipe text. */
export function looksLikeUrl(input: string): boolean {
  const text = input.trim();
  if (!text || /\s/.test(text)) return false;
  return /^https?:\/\//i.test(text) || /^(www\.)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(text);
}

const INGREDIENTS_HEADING = /^ingredients?\s*:?$/i;
const STEPS_HEADING =
  /^(preparation|instructions|directions|method|steps|how to make( it)?|to make)\s*:?$/i;

// Page furniture that ends a section: NYT's substitution guide and nutrition
// panel under the ingredients, and tips, notes, ratings and comments under
// the steps.
const SECTION_END =
  /^(ingredient substitution guide|nutritional (analysis|information)|nutrition( facts)?|tips?|cook'?s? notes?|notes?|private notes|cooking notes|community notes|ratings?|reviews?|comments?|rate this recipe|related|more recipes|you may also like|advertisement|share|print)\b/i;

const YIELD = /\b(?:yield|yields|serves|servings|makes)\s*:?\s*(\d+)/i;
const STEP_MARKER = /^step\s*(\d+)\s*[:.]?\s*/i;
const QUANTITY_CHARS = '\\d½¼¾⅓⅔⅛⅜⅝⅞';
// A line that is only an amount ("1", "1½", "2 to 3"): NYT Cooking puts the
// quantity and the rest of the ingredient on separate lines when copied.
const QUANTITY_ONLY = new RegExp(
  `^[${QUANTITY_CHARS}][${QUANTITY_CHARS}\\s/.]*(\\s*(to|-|–|or)\\s*[${QUANTITY_CHARS}][${QUANTITY_CHARS}\\s/.]*)?$`,
  'i',
);
const STARTS_WITH_QUANTITY = new RegExp(`^([-*•]\\s*)?[${QUANTITY_CHARS}]`);

// Byline, dates, timings and buttons around a title — never the description.
const META_LINE =
  /^(by\s|updated|published|total time|prep time|cook time|active time|time\b|rating|read community notes|save|print|\d+\s*(minutes?|hours?|mins?|hrs?)\b|\(?[\d,.]+\)?$)/i;

export function parseRecipeText(raw: string): ImportedRecipe {
  const lines = raw
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const ingStart = lines.findIndex((l) => INGREDIENTS_HEADING.test(l));
  const stepsStart = lines.findIndex(
    (l, i) => i > ingStart && STEPS_HEADING.test(l),
  );

  let ingredientLines: string[];
  let stepLines: string[];

  if (ingStart >= 0) {
    const ingEnd = stepsStart >= 0 ? stepsStart : lines.length;
    const section = untilSectionEnd(lines.slice(ingStart + 1, ingEnd));
    if (stepsStart >= 0) {
      ingredientLines = section;
      stepLines = untilSectionEnd(lines.slice(stepsStart + 1));
    } else {
      // No method heading: the ingredients run until the first long line
      // that isn't one, and the rest is the method.
      const split = section.findIndex(isProseLine);
      ingredientLines = split >= 0 ? section.slice(0, split) : section;
      stepLines = split >= 0 ? section.slice(split) : [];
    }
  } else {
    // No headings at all: amounts make ingredients, paragraphs make steps.
    const body = lines.slice(1);
    ingredientLines = body.filter((l) => STARTS_WITH_QUANTITY.test(l) && !isProseLine(l));
    const firstStep = body.findIndex(isProseLine);
    stepLines = firstStep >= 0 ? untilSectionEnd(body.slice(firstStep)).filter(isProseLine) : [];
  }

  const ingredients = joinQuantities(ingredientLines.filter((l) => !isIngredientNoise(l)))
    .map(parseIngredientLine)
    .filter((ing) => ing.name);
  const steps = groupSteps(stepLines);

  if (ingredients.length === 0 && steps.length === 0) {
    throw new ImportError('NO_RECIPE', 'No recipe found in this text');
  }

  const headerEnd = ingStart >= 0 ? ingStart : lines.length;
  const titleIndex = findTitleIndex(lines, headerEnd);
  const yieldMatch = raw.match(YIELD);
  const url = raw.match(/https?:\/\/[^\s)]+/i);

  return {
    title: titleIndex >= 0 ? lines[titleIndex].slice(0, 120) : '',
    source_url: url ? url[0] : '',
    servings: yieldMatch ? Math.max(1, parseInt(yieldMatch[1], 10)) : 4,
    ingredients,
    steps,
    notes: findDescription(lines.slice(titleIndex + 1, headerEnd)),
  };
}

function untilSectionEnd(lines: string[]): string[] {
  const end = lines.findIndex((l) => SECTION_END.test(l) && l.length < 40 && !/[.!]$/.test(l));
  return end >= 0 ? lines.slice(0, end) : lines;
}

function isProseLine(line: string): boolean {
  return line.length > 90 || (line.length > 40 && /[.!]$/.test(line) && !STARTS_WITH_QUANTITY.test(line));
}

// Yield lines, sub-headings ("For the sauce", "Dressing:") and stray buttons.
function isIngredientNoise(line: string): boolean {
  if (YIELD.test(line) && line.length < 40) return true;
  if (/:$/.test(line) && line.length < 50) return true;
  if (/^for (the |serving|garnish)/i.test(line) && line.length < 50 && !/\d/.test(line)) return true;
  return /^(add to (your )?grocery list|shop ingredients|jump to recipe)/i.test(line);
}

function joinQuantities(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (QUANTITY_ONLY.test(lines[i]) && i + 1 < lines.length && !STARTS_WITH_QUANTITY.test(lines[i + 1])) {
      out.push(`${lines[i]} ${lines[i + 1]}`);
      i++;
    } else {
      out.push(lines[i]);
    }
  }
  return out;
}

// "Step 1" / "Step 2" markers (NYT) group the lines that follow them;
// otherwise every line is its own step.
function groupSteps(lines: string[]): string[] {
  if (!lines.some((l) => STEP_MARKER.test(l))) {
    return lines.map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  }
  const steps: string[] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    const marker = line.match(STEP_MARKER);
    if (marker) {
      if (current?.length) steps.push(current.join(' '));
      current = [];
      const rest = line.slice(marker[0].length).trim();
      if (rest) current.push(rest);
    } else if (current) {
      current.push(line);
    }
  }
  if (current?.length) steps.push(current.join(' '));
  return steps;
}

// The line before a "By …" byline is the title; failing that, the first line
// that isn't page furniture.
function findTitleIndex(lines: string[], before: number): number {
  const byline = lines.findIndex((l, i) => i < before && /^by\s+\S/i.test(l));
  if (byline > 0) return byline - 1;
  return lines.findIndex(
    (l, i) => i < before && !META_LINE.test(l) && !INGREDIENTS_HEADING.test(l) && l.length <= 120,
  );
}

function findDescription(lines: string[]): string {
  const prose = lines.filter((l) => !META_LINE.test(l) && l.length >= 60);
  return prose.sort((a, b) => b.length - a.length)[0] ?? '';
}
