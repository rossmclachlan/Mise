import type { Ingredient } from '../types';
import { parseIngredientLine } from './parseIngredient';

export interface ImportedRecipe {
  title: string;
  source_url: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  notes: string;
}

export class ImportError extends Error {
  code: 'NETWORK' | 'NO_RECIPE';

  constructor(code: 'NETWORK' | 'NO_RECIPE', message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

interface JsonLdNode {
  '@type'?: string | string[];
  '@graph'?: unknown;
  [key: string]: unknown;
}

async function fetchViaProxy(url: string): Promise<string> {
  // Try allorigins first; fall back to corsproxy.io if it fails or returns empty.
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    );
    if (res.ok) {
      const data = (await res.json()) as { contents?: string | null };
      if (data.contents) return data.contents;
    }
  } catch {
    // fall through
  }

  const res2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
  if (!res2.ok) throw new Error(`Proxy responded with ${res2.status}`);
  const text = await res2.text();
  if (!text) throw new Error('Empty response from proxy');
  return text;
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  let html: string;
  try {
    html = await fetchViaProxy(url);
  } catch {
    throw new ImportError('NETWORK', "Couldn't reach this page");
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const recipe = findRecipeData(doc);

  if (!recipe) throw new ImportError('NO_RECIPE', 'No recipe found on this page');

  return {
    title: typeof recipe.name === 'string' ? recipe.name.trim() : '',
    source_url: url,
    servings: parseServings(recipe.recipeYield),
    ingredients: parseIngredients(recipe.recipeIngredient),
    steps: parseSteps(recipe.recipeInstructions),
    notes: typeof recipe.description === 'string' ? recipe.description.trim() : '',
  };
}

function findRecipeData(doc: Document): JsonLdNode | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent ?? '');
      const found = findRecipeNode(json);
      if (found) return found;
    } catch {
      // Skip malformed JSON-LD blocks and keep looking.
    }
  }
  return null;
}

function findRecipeNode(value: unknown): JsonLdNode | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }

  if (!value || typeof value !== 'object') return null;
  const node = value as JsonLdNode;

  const type = node['@type'];
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
    return node;
  }

  if (Array.isArray(node['@graph'])) {
    return findRecipeNode(node['@graph']);
  }

  return null;
}

// recipeYield can be "4 servings", "Serves 4", a bare number, or an array of those.
function parseServings(value: unknown): number {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return Math.max(1, Math.round(candidate));
  }

  if (typeof candidate === 'string') {
    const match = candidate.match(/\d+/);
    if (match) return Math.max(1, parseInt(match[0], 10));
  }

  return 4;
}

function parseIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((line): line is string => typeof line === 'string' && line.trim() !== '')
    .map((line) => parseIngredientLine(line));
}

// recipeInstructions can be a string, an array of strings, an array of
// HowToStep objects, or HowToSection objects with nested HowToSteps.
function parseSteps(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap(parseStepNode).filter(Boolean);
  }

  return [];
}

function parseStepNode(value: unknown): string[] {
  if (typeof value === 'string') return [value.trim()];

  if (value && typeof value === 'object') {
    const node = value as JsonLdNode;
    if (Array.isArray(node.itemListElement)) {
      return node.itemListElement.flatMap(parseStepNode);
    }
    if (typeof node.text === 'string') return [node.text.trim()];
    if (typeof node.name === 'string') return [node.name.trim()];
  }

  return [];
}
