import { Plus } from 'lucide-react';
import type { Recipe } from '../../types';
import { getDomain } from '../../utils/url';
import { RecipeImage } from '../ui/RecipeImage';

interface RecipeGridProps {
  recipes: Recipe[];
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function RecipeGrid({ recipes, onSelect, onAdd }: RecipeGridProps) {
  return (
    <div className="px-4 pt-4">
      {recipes.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink-variant">
          No recipes yet. Tap the + button to add your first recipe.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {recipes.map((recipe) => {
            const domain = getDomain(recipe.source_url);
            return (
              <button
                key={recipe.id}
                type="button"
                onClick={() => onSelect(recipe.id)}
                className="card flex flex-col items-start overflow-hidden text-left active:shadow-none"
              >
                <RecipeImage className="aspect-square w-full" />
                <div className="flex flex-col items-start p-3">
                  <span className="font-semibold leading-snug">{recipe.title}</span>
                  {domain && (
                    <span className="mt-1 text-xs text-ink-variant">{domain}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        aria-label="Add recipe"
        className="fab absolute bottom-20 right-4 z-30"
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
