import type { Ingredient } from '../types';
import { parseIngredientLine } from './parseIngredient';

export interface ImportedRecipe {
  title: string;
  source_url: string;
  image?: string;
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

// The app has no backend, so it borrows public CORS proxies to fetch recipe
// pages. Each one flakes independently — some go down, some rate-limit, and
// some sites serve a bot-challenge page to datacenter proxy IPs — so we try
// every proxy and, crucially, attempt to parse each response before moving on.
// An optional self-hosted proxy (a Cloudflare Worker, say) can be slotted in
// first via localStorage('recipe_proxy') for a reliable path.
type ProxyFetch = (url: string) => Promise<string>;

const PUBLIC_PROXIES: ProxyFetch[] = [
  async (url) => {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { contents?: string | null };
    if (!data.contents) throw new Error('empty');
    return data.contents;
  },
  async (url) => {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(String(res.status));
    return res.text();
  },
  async (url) => {
    const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(String(res.status));
    return res.text();
  },
  async (url) => {
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(String(res.status));
    return res.text();
  },
];

function proxyChain(): ProxyFetch[] {
  let custom: string | null = null;
  try {
    custom = localStorage.getItem('recipe_proxy');
  } catch {
    // localStorage unavailable — ignore
  }
  if (!custom) return PUBLIC_PROXIES;

  const base = custom.trim();
  const customFetch: ProxyFetch = async (url) => {
    // Support "https://worker/?url=" (has a query slot) or a bare prefix.
    const target = base.includes('?')
      ? `${base}${encodeURIComponent(url)}`
      : `${base}${base.endsWith('/') ? '' : '/'}${encodeURIComponent(url)}`;
    const res = await fetch(target);
    if (!res.ok) throw new Error(String(res.status));
    return res.text();
  };
  return [customFetch, ...PUBLIC_PROXIES];
}

/**
 * Parses a fetched HTML document for schema.org Recipe JSON-LD.
 * Exported separately from the fetch so it can be exercised directly.
 */
export function parseRecipeHtml(html: string, url: string): ImportedRecipe {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const recipe = findRecipeData(doc);

  if (!recipe) throw new ImportError('NO_RECIPE', 'No recipe found on this page');

  return {
    title: typeof recipe.name === 'string' ? recipe.name.trim() : '',
    source_url: url,
    image: parseImage(recipe.image),
    servings: parseServings(recipe.recipeYield),
    ingredients: parseIngredients(recipe.recipeIngredient),
    steps: parseSteps(recipe.recipeInstructions),
    notes: typeof recipe.description === 'string' ? recipe.description.trim() : '',
  };
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  let reachedAny = false;

  for (const fetchViaProxy of proxyChain()) {
    let html: string;
    try {
      html = await fetchViaProxy(url);
    } catch {
      continue; // proxy down / rate-limited / blocked — try the next one
    }
    if (!html) continue;
    reachedAny = true;

    try {
      return parseRecipeHtml(html, url);
    } catch {
      // We got a page but found no recipe in it — often a bot-challenge or a
      // proxy error page. Try another proxy before giving up.
      continue;
    }
  }

  // If no proxy ever returned a page, it's a reachability problem; if pages
  // came back but none held a recipe, it's a parsing/blocking problem.
  throw reachedAny
    ? new ImportError('NO_RECIPE', 'No recipe found on this page')
    : new ImportError('NETWORK', "Couldn't reach this page");
}

// recipe.image can be a URL string, an array of URL strings, an
// ImageObject ({ url } or { contentUrl }), or an array of those.
function parseImage(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate === 'string') return candidate;

  if (candidate && typeof candidate === 'object') {
    const node = candidate as JsonLdNode;
    if (typeof node.url === 'string') return node.url;
    if (typeof node.contentUrl === 'string') return node.contentUrl;
  }

  return undefined;
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
