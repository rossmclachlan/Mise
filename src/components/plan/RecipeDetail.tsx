import { useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Minus, Plus, Trash2 } from 'lucide-react';
import type { GroceryItem, Recipe } from '../../types';
import { scaleAmount } from '../../utils/scale';
import { getDomain } from '../../utils/url';
import { BottomSheet } from '../ui/BottomSheet';
import { RecipeImage } from '../ui/RecipeImage';

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
        text: [scaleAmount(ing.amount, ratio), ing.unit, ing.name].filter(Boolean).join(' '),
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
        className="mb-3 flex items-center gap-1 text-sm font-medium text-ink-variant"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <RecipeImage className="mb-4 h-40 w-full rounded-2xl" iconSize={40} />

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

      <div className="card mt-4 flex items-center gap-3 p-3">
        <span className="font-medium">Servings</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
            aria-label="Decrease servings"
            className="btn-icon"
          >
            <Minus size={16} />
          </button>
          <span className="w-6 text-center font-semibold">{servings}</span>
          <button
            type="button"
            onClick={() => setServings((s) => s + 1)}
            aria-label="Increase servings"
            className="btn-icon"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <section className="mt-4">
        <h2 className="mb-2 text-lg font-semibold">Ingredients</h2>
        <ul className="card p-3">
          {recipe.ingredients.map((ing, i) => (
            <li
              key={i}
              className={`flex justify-between gap-3 py-1.5 text-sm ${
                i > 0 ? 'border-t border-outline/60' : ''
              }`}
            >
              <span>{ing.name}</span>
              <span className="shrink-0 text-ink-variant">
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
            <li key={i} className="card p-3 text-sm">
              <span className="mr-2 font-semibold text-accent">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      {recipe.notes && (
        <section className="mt-4">
          <h2 className="mb-2 text-lg font-semibold">Notes</h2>
          <p className="card p-3 text-sm">{recipe.notes}</p>
        </section>
      )}

      <button type="button" onClick={openConfirm} className="btn-filled mt-6 w-full">
        Add to Grocery List
      </button>

      <button type="button" onClick={handleDelete} className="btn-danger mt-3 w-full">
        <Trash2 size={18} /> Delete Recipe
      </button>

      <BottomSheet
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Add to Grocery List"
      >
        <p className="mb-2 text-sm text-ink-variant">
          Deselect anything you already have.
        </p>
        <ul className="divide-y divide-outline/60">
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>
              <label className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleIngredient(i)}
                  className="sr-only"
                />
                <span
                  className={`checkbox-indicator h-5 w-5 ${
                    selected.has(i) ? 'border-accent bg-accent text-white' : 'border-outline'
                  }`}
                >
                  {selected.has(i) && <Check size={14} strokeWidth={3} />}
                </span>
                <span className="flex-1 text-sm">{ing.name}</span>
                <span className="shrink-0 text-sm text-ink-variant">
                  {formatAmount(scaleAmount(ing.amount, ratio), ing.unit)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button type="button" onClick={handleConfirmAdd} className="btn-filled mb-2 mt-4 w-full">
          Add {selected.size} {selected.size === 1 ? 'Item' : 'Items'}
        </button>
      </BottomSheet>
    </div>
  );
}
