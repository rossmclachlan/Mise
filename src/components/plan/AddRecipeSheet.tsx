import { useState, type ReactNode } from 'react';
import type { Ingredient, Recipe } from '../../types';
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
  servings: string;
  ingredientsText: string;
  stepsText: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  sourceUrl: '',
  servings: '4',
  ingredientsText: '',
  stepsText: '',
  notes: '',
};

const inputClass =
  'rounded-lg border border-gray-200 px-3 py-2 text-base focus:border-accent focus:outline-none';

function stripStepNumbering(line: string): string {
  return line.replace(/^\s*\d+[.)]\s*/, '').trim();
}

export function AddRecipeSheet({ isOpen, onClose, onSave }: AddRecipeSheetProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [parsedIngredients, setParsedIngredients] = useState<Ingredient[]>([]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetAndClose() {
    setForm(EMPTY_FORM);
    setStep('form');
    setParsedIngredients([]);
    onClose();
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
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 rounded-xl border border-gray-200 py-3 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={!form.title.trim()}
              className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-4">
          <p className="text-sm text-ink/60">
            Here's how we parsed your ingredients. Go back to edit the raw
            text if anything looks off.
          </p>

          {parsedIngredients.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-3 text-sm text-ink/50">
              No ingredients added.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl bg-white">
              {parsedIngredients.map((ing, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{ing.name || '—'}</span>
                  <span className="shrink-0 text-ink/50">
                    {[ing.amount, ing.unit].filter(Boolean).join(' ') || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="flex-1 rounded-xl border border-gray-200 py-3 font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white"
            >
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
      <span className="text-sm font-medium text-ink/70">{label}</span>
      {children}
    </label>
  );
}
