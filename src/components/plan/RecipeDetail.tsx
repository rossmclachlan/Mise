import { useState } from 'react';
import { ArrowLeft, ExternalLink, Minus, Plus, Trash2 } from 'lucide-react';
import type { GroceryItem, Recipe } from '../../types';
import { scaleAmount } from '../../utils/scale';
import { guessCategory } from '../../utils/categorize';
import { getDomain } from '../../utils/url';
import { BottomSheet } from '../ui/BottomSheet';

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
  onDelete: () => void;
  onAddToGroceryList: (items: GroceryItem[]) => void;
}

function formatAmount(amount: string, unit: string): string {
  return [amount, unit].filter(Boolean).join(' ');
}

export function RecipeDetail({ recipe, onBack, onDelete, onAddToGroceryList }: RecipeDetailProps) {
  const [servings, setServings] = useState(recipe.servings);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(
    new Set(recipe.ingredients.map((_, i) => i)),
  );

  const ratio = servings / Math.max(1, recipe.servings);
  const domain = getDomain(recipe.source_url);

  function toggleIngredient(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function openConfirm() {
    setSelected(new Set(recipe.ingredients.map((_, i) => i)));
    setConfirmOpen(true);
  }

  function handleConfirmAdd() {
    const items: GroceryItem[] = recipe.ingredients
      .filter((_, i) => selected.has(i))
      .map((ing) => ({
        id: crypto.randomUUID(),
        name: ing.name,
        amount: scaleAmount(ing.amount, ratio),
        unit: ing.unit,
        category: guessCategory(ing.name),
        checked: false,
        from_recipe_id: recipe.id,
      }));
    onAddToGroceryList(items);
    setConfirmOpen(false);
  }

  function handleDelete() {
    if (window.confirm(`Delete "${recipe.title}"? This can't be undone.`)) {
      onDelete();
    }
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-sm font-medium text-ink/60"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <h1 className="text-2xl font-bold">{recipe.title}</h1>
      {recipe.source_url && (
        <a
          href={recipe.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-sm text-accent"
        >
          {domain ?? recipe.source_url}
          <ExternalLink size={14} />
        </a>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
        <span className="font-medium">Servings</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
            aria-label="Decrease servings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <Minus size={16} />
          </button>
          <span className="w-6 text-center font-semibold">{servings}</span>
          <button
            type="button"
            onClick={() => setServings((s) => s + 1)}
            aria-label="Increase servings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <section className="mt-4">
        <h2 className="mb-2 text-lg font-semibold">Ingredients</h2>
        <ul className="rounded-xl bg-white p-3 shadow-sm">
          {recipe.ingredients.map((ing, i) => (
            <li
              key={i}
              className={`flex justify-between gap-3 py-1.5 text-sm ${
                i > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              <span>{ing.name}</span>
              <span className="shrink-0 text-ink/60">
                {formatAmount(scaleAmount(ing.amount, ratio), ing.unit)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-lg font-semibold">Steps</h2>
        <ol className="space-y-2">
          {recipe.steps.map((step, i) => (
            <li key={i} className="rounded-xl bg-white p-3 text-sm shadow-sm">
              <span className="mr-2 font-semibold text-accent">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      {recipe.notes && (
        <section className="mt-4">
          <h2 className="mb-2 text-lg font-semibold">Notes</h2>
          <p className="rounded-xl bg-white p-3 text-sm shadow-sm">{recipe.notes}</p>
        </section>
      )}

      <button
        type="button"
        onClick={openConfirm}
        className="mt-6 w-full rounded-xl bg-accent py-3 font-semibold text-white"
      >
        Add to Grocery List
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 font-medium text-red-600"
      >
        <Trash2 size={18} /> Delete Recipe
      </button>

      <BottomSheet
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Add to Grocery List"
      >
        <p className="mb-2 text-sm text-ink/60">
          Deselect anything you already have.
        </p>
        <ul className="divide-y divide-gray-100">
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>
              <label className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleIngredient(i)}
                  className="h-5 w-5 accent-accent"
                />
                <span className="flex-1 text-sm">{ing.name}</span>
                <span className="shrink-0 text-sm text-ink/50">
                  {formatAmount(scaleAmount(ing.amount, ratio), ing.unit)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={handleConfirmAdd}
          className="mb-2 mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-white"
        >
          Add {selected.size} {selected.size === 1 ? 'Item' : 'Items'}
        </button>
      </BottomSheet>
    </div>
  );
}
