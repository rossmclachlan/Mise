import type { Dispatch, SetStateAction } from 'react';
import type { GroceryItem, Staple } from '../../types';
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
          {groceryList.length > 0 && (
            <ChecklistSection title="Grocery List" items={groceryList} onToggle={toggleItem} large />
          )}
        </div>
      )}
    </div>
  );
}
