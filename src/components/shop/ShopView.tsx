import type { Dispatch, SetStateAction } from 'react';
import {
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABELS,
  type GroceryCategory,
  type GroceryItem,
  type PantryItem,
  type Staple,
} from '../../types';
import { categoriseItem, learnCategory } from '../../utils/categorise';
import { useWakeLock } from '../../hooks/useWakeLock';
import { ChecklistSection } from '../ui/ChecklistSection';
import { ItemListSection } from '../ui/ItemListSection';

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

interface GroceryViewProps {
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
  staples: Staple[];
  setStaples: Dispatch<SetStateAction<Staple[]>>;
  pantry: PantryItem[];
  setPantry: Dispatch<SetStateAction<PantryItem[]>>;
}

export function GroceryView({
  groceryList,
  setGroceryList,
  staples,
  setStaples,
  pantry,
  setPantry,
}: GroceryViewProps) {
  useWakeLock(true);

  const hasChecked =
    groceryList.some((item) => item.checked) || staples.some((staple) => staple.checked);

  function toggleItem(id: string) {
    setGroceryList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  }

  function removeItem(id: string) {
    setGroceryList((prev) => prev.filter((item) => item.id !== id));
  }

  function addItem(text: string, category?: GroceryCategory) {
    setGroceryList((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, checked: false, category: category ?? categoriseItem(text) },
    ]);
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

  function toggleStaple(id: string) {
    setStaples((prev) =>
      prev.map((staple) => (staple.id === id ? { ...staple, checked: !staple.checked } : staple)),
    );
  }

  function removeStaple(id: string) {
    setStaples((prev) => prev.filter((staple) => staple.id !== id));
  }

  function addStaple(text: string) {
    setStaples((prev) => [...prev, { id: crypto.randomUUID(), text, checked: false }]);
  }

  function clearChecked() {
    setGroceryList((prev) => prev.filter((item) => !item.checked));
    setStaples((prev) => prev.map((staple) => ({ ...staple, checked: false })));
  }

  function removePantryItem(id: string) {
    setPantry((prev) => prev.filter((item) => item.id !== id));
  }

  function addPantryItem(text: string) {
    setPantry((prev) => [...prev, { id: crypto.randomUUID(), text }]);
  }

  const groceryByCategory = GROCERY_CATEGORIES.map((category) => ({
    category,
    items: groceryList.filter((item) => (item.category ?? 'other') === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grocery</h1>
        <button
          type="button"
          onClick={clearChecked}
          disabled={!hasChecked}
          className="btn-tonal px-4 py-2.5 text-sm"
        >
          Clear checked
        </button>
      </div>

      <div className="space-y-5">
        <ChecklistSection
          title="Staples"
          items={staples}
          onToggle={toggleStaple}
          onRemove={removeStaple}
          onAdd={addStaple}
          addPlaceholder="Add a staple"
          emptyText="No staples yet."
          large
        />

        {groceryByCategory.map(({ category, items }) => (
          <ChecklistSection
            key={category}
            title={GROCERY_CATEGORY_LABELS[category]}
            accent={CATEGORY_ACCENT[category]}
            items={items}
            onToggle={toggleItem}
            onRemove={removeItem}
            onCategoryChange={changeItemCategory}
            large
            pantryItems={pantry}
          />
        ))}

        <ChecklistSection
          items={[]}
          onToggle={() => {}}
          onAdd={addItem}
          showCategoryPreview
          addPlaceholder="Add grocery item"
          large
        />

        <ItemListSection
          title="Pantry"
          items={pantry}
          onRemove={removePantryItem}
          onAdd={addPantryItem}
          addPlaceholder="Add a pantry item"
          emptyText="No pantry items yet."
        />
      </div>
    </div>
  );
}
