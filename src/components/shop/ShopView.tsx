import type { Dispatch, SetStateAction } from 'react';
import {
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABELS,
  type GroceryCategory,
  type GroceryItem,
  type Staple,
} from '../../types';

const CATEGORY_ACCENT: Record<GroceryCategory, string> = {
  produce: '#14532D',
  dairy: '#1E3A8A',
  meat: '#7F1D1D',
  fish: '#134E4A',
  bakery: '#78350F',
  pantry: '#4C1D95',
  frozen: '#0C4A6E',
  drinks: '#831843',
  other: '#334155',
};
import { learnCategory } from '../../utils/categorise';
import { useWakeLock } from '../../hooks/useWakeLock';
import { ChecklistSection } from '../ui/ChecklistSection';

interface ShopViewProps {
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
  staples: Staple[];
  setStaples: Dispatch<SetStateAction<Staple[]>>;
}

export function ShopView({ groceryList, setGroceryList, staples, setStaples }: ShopViewProps) {
  useWakeLock(true);

  const hasChecked =
    groceryList.some((item) => item.checked) || staples.some((staple) => staple.checked);

  function toggleItem(id: string) {
    setGroceryList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  }

  function toggleStaple(id: string) {
    setStaples((prev) =>
      prev.map((staple) => (staple.id === id ? { ...staple, checked: !staple.checked } : staple)),
    );
  }

  function clearChecked() {
    setGroceryList((prev) => prev.filter((item) => !item.checked));
    setStaples((prev) => prev.map((staple) => ({ ...staple, checked: false })));
  }

  function changeItemCategory(id: string, category: GroceryCategory) {
    setGroceryList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        learnCategory(item.text, category);
        return { ...item, category };
      }),
    );
  }

  const groceryByCategory = GROCERY_CATEGORIES.map((category) => ({
    category,
    items: groceryList.filter((item) => (item.category ?? 'other') === category),
  })).filter((group) => group.items.length > 0);

  const isEmpty = groceryList.length === 0 && staples.length === 0;

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shop</h1>
        <button
          type="button"
          onClick={clearChecked}
          disabled={!hasChecked}
          className="btn-tonal px-4 py-2.5 text-sm"
        >
          Clear checked
        </button>
      </div>

      {isEmpty ? (
        <p className="mt-16 text-center text-base text-ink-variant">
          Your list is empty. Add items in Plan mode.
        </p>
      ) : (
        <div className="space-y-5">
          {staples.length > 0 && (
            <ChecklistSection title="Staples" items={staples} onToggle={toggleStaple} large />
          )}
          {groceryByCategory.map(({ category, items }) => (
            <ChecklistSection
              key={category}
              title={GROCERY_CATEGORY_LABELS[category]}
              accent={CATEGORY_ACCENT[category]}
              items={items}
              onToggle={toggleItem}
              onCategoryChange={changeItemCategory}
              large
            />
          ))}
        </div>
      )}
    </div>
  );
}
