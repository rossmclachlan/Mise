import { useState } from 'react';
import { Search } from 'lucide-react';
import type { Recipe } from '../../types';
import { getDomain } from '../../utils/url';

interface CookListProps {
  recipes: Recipe[];
  onSelect: (id: string) => void;
}

export function CookList({ recipes, onSelect }: CookListProps) {
  const [query, setQuery] = useState('');

  const filtered = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="mb-4 text-2xl font-bold">Cook</h1>

      <div className="mb-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm">
        <Search size={18} className="text-ink/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes"
          className="flex-1 bg-transparent text-base outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink/50">No recipes found.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((recipe) => {
            const domain = getDomain(recipe.source_url);
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => onSelect(recipe.id)}
                  className="flex w-full flex-col items-start rounded-xl bg-white p-4 text-left shadow-sm active:shadow-none"
                >
                  <span className="font-semibold">{recipe.title}</span>
                  <span className="mt-1 text-xs text-ink/50">
                    {domain ?? `${recipe.steps.length} steps`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
