import { useState, type ReactNode } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { Ingredient, Recipe } from '../../types';
import { ImportError, importRecipeFromUrl } from '../../utils/importRecipe';
import { parseIngredientLine } from '../../utils/parseIngredient';
import { normalizeUrl } from '../../utils/url';
import { BottomSheet } from '../ui/BottomSheet';

interface AddRecipeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
}

interface FormState {
  title: string;
  sourceUrl: string;
  image: string;
  servings: string;
  ingredientsText: string;
  stepsText: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  sourceUrl: '',
  image: '',
  servings: '4',
  ingredientsText: '',
  stepsText: '',
  notes: '',
};

const inputClass = 'input-field';

function stripStepNumbering(line: string): string {
  return line.replace(/^\s*\d+[.)]\s*/, '').trim();
}

function formatIngredientLine(ing: Ingredient): string {
  return [ing.amount, ing.unit, ing.name].filter(Boolean).join(' ');
}

type ImportStatus = 'idle' | 'loading' | 'success' | 'error';

function isNYTCookingUrl(url: string) {
  return /cooking\.nytimes\.com|nytimes\.com\/recipes/i.test(url);
}

function isNYTGiftLink(url: string) {
  return isNYTCookingUrl(url) && /unlocked_article_code=/i.test(url);
}

export function AddRecipeSheet({ isOpen, onClose, onSave }: AddRecipeSheetProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [parsedIngredients, setParsedIngredients] = useState<Ingredient[]>([]);
  const [importUrl, setImportUrl] = useState('');
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importErrorMessage, setImportErrorMessage] = useState('');

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetAndClose() {
    setForm(EMPTY_FORM);
    setStep('form');
    setParsedIngredients([]);
    setImportUrl('');
    setImportStatus('idle');
    setImportErrorMessage('');
    onClose();
  }

  async function handleImport() {
    const url = importUrl.trim();
    if (!url) return;

    setImportStatus('loading');
    setImportErrorMessage('');

    try {
      const imported = await importRecipeFromUrl(url);
      setForm((f) => ({
        ...f,
        title: imported.title || f.title,
        sourceUrl: imported.source_url,
        image: imported.image ?? f.image,
        servings: String(imported.servings),
        ingredientsText: imported.ingredients.map(formatIngredientLine).join('\n'),
        stepsText: imported.steps.join('\n'),
        notes: imported.notes,
      }));
      setImportStatus('success');
    } catch (err) {
      setImportStatus('error');
      if (isNYTCookingUrl(url) && !isNYTGiftLink(url)) {
        setImportErrorMessage(
          'NYT Cooking recipes are paywalled — paste a gift link instead (tap Share → Gift Recipe in the app)',
        );
      } else if (err instanceof ImportError && err.code === 'NO_RECIPE') {
        setImportErrorMessage('No recipe found on this page');
      } else {
        setImportErrorMessage("Couldn't reach this page");
      }
    }
  }

  function handlePreview() {
    if (!form.title.trim()) return;
    const lines = form.ingredientsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    setParsedIngredients(lines.map(parseIngredientLine));
    setStep('preview');
  }

  function handleSave() {
    const steps = form.stepsText
      .split('\n')
      .map(stripStepNumbering)
      .filter(Boolean);

    const recipe: Recipe = {
      id: crypto.randomUUID(),
      title: form.title.trim(),
      source_url: form.sourceUrl.trim()
        ? normalizeUrl(form.sourceUrl.trim())
        : undefined,
      image: form.image.trim() || undefined,
      servings: Math.max(1, Number(form.servings) || 1),
      ingredients: parsedIngredients,
      steps,
      notes: form.notes.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    onSave(recipe);
    resetAndClose();
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={resetAndClose}
      title={step === 'form' ? 'Add Recipe' : 'Confirm Ingredients'}
      tall
    >
      {step === 'form' ? (
        <div className="flex flex-col gap-4 pb-4">
          <div className="flex flex-col gap-2 rounded-2xl bg-surface-variant p-3">
            <span className="text-sm font-medium text-ink-variant">Import from URL</span>
            <div className="flex gap-2">
              <input
                type="url"
                className={`${inputClass} flex-1`}
                value={importUrl}
                onChange={(e) => {
                  setImportUrl(e.target.value);
                  setImportStatus('idle');
                  setImportErrorMessage('');
                }}
                placeholder="Paste a recipe URL"
              />
              <button
                type="button"
                onClick={handleImport}
                disabled={!importUrl.trim() || importStatus === 'loading'}
                className="btn-tonal shrink-0 px-4"
              >
                {importStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 'Import'}
              </button>
            </div>
            {importStatus === 'idle' && isNYTCookingUrl(importUrl) && !isNYTGiftLink(importUrl) && (
              <p className="text-sm text-ink-variant">
                NYT Cooking requires a gift link.{' '}
                <span className="font-medium text-ink">Tap Share → Gift Recipe</span> in the NYT
                Cooking app, then paste that link here.
              </p>
            )}
            {importStatus === 'loading' && (
              <p className="text-sm text-ink-variant">Fetching recipe…</p>
            )}
            {importStatus === 'success' && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-accent">
                <CheckCircle2 size={16} />
                Recipe imported — review and save below
              </p>
            )}
            {importStatus === 'error' && (
              <p className="text-sm font-medium text-error">{importErrorMessage}</p>
            )}
            {form.image && (
              <img src={form.image} alt="" className="h-32 w-full rounded-xl object-cover" />
            )}
          </div>

          <Field label="Title">
            <input
              type="text"
              className={inputClass}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="Spaghetti Aglio e Olio"
            />
          </Field>

          <Field label="Source URL (optional)">
            <input
              type="url"
              className={inputClass}
              value={form.sourceUrl}
              onChange={(e) => update('sourceUrl', e.target.value)}
              placeholder="https://example.com/recipe"
            />
          </Field>

          <Field label="Servings">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className={inputClass}
              value={form.servings}
              onChange={(e) => update('servings', e.target.value)}
            />
          </Field>

          <Field label="Ingredients">
            <textarea
              className={inputClass}
              rows={6}
              value={form.ingredientsText}
              onChange={(e) => update('ingredientsText', e.target.value)}
              placeholder={'One per line, e.g.\n2 cups flour\n1/2 tsp salt\n3 large eggs\nhandful of parsley'}
            />
          </Field>

          <Field label="Steps">
            <textarea
              className={inputClass}
              rows={6}
              value={form.stepsText}
              onChange={(e) => update('stepsText', e.target.value)}
              placeholder={'One step per line, e.g.\n1. Preheat oven to 350°F\n2. Mix dry ingredients'}
            />
          </Field>

          <Field label="Notes (optional)">
            <textarea
              className={inputClass}
              rows={3}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </Field>

          <div className="mt-2 flex gap-3">
            <button type="button" onClick={resetAndClose} className="btn-outlined flex-1">
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={!form.title.trim()}
              className="btn-filled flex-1"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-4">
          <p className="text-sm text-ink-variant">
            Here's how we parsed your ingredients. Go back to edit the raw
            text if anything looks off.
          </p>

          {parsedIngredients.length === 0 ? (
            <p className="rounded-2xl bg-surface-variant p-3 text-sm text-ink-variant">
              No ingredients added.
            </p>
          ) : (
            <ul className="card divide-y divide-outline/60 overflow-hidden">
              {parsedIngredients.map((ing, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{ing.name || '—'}</span>
                  <span className="shrink-0 text-ink-variant">
                    {[ing.amount, ing.unit].filter(Boolean).join(' ') || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => setStep('form')} className="btn-outlined flex-1">
              Back
            </button>
            <button type="button" onClick={handleSave} className="btn-filled flex-1">
              Save Recipe
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink-variant">{label}</span>
      {children}
    </label>
  );
}
