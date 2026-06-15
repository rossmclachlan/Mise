import type { Dispatch, SetStateAction } from 'react';
import { Check } from 'lucide-react';
import { CATEGORY_LABELS, GROCERY_CATEGORIES, type GroceryItem } from '../../types';
import { useWakeLock } from '../../hooks/useWakeLock';

interface ShopViewProps {
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
}

export function ShopView({ groceryList, setGroceryList }: ShopViewProps) {
  useWakeLock(true);

  const grouped = GROCERY_CATEGORIES.map((category) => ({
    category,
    items: groceryList
      .filter((item) => item.category === category)
      .sort((a, b) => Number(a.checked) - Number(b.checked)),
  })).filter((group) => group.items.length > 0);

  const hasChecked = groceryList.some((item) => item.checked);

  function toggleItem(id: string) {
    setGroceryList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  }

  function clearChecked() {
    setGroceryList((prev) => prev.filter((item) => !item.checked));
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shop</h1>
        <button
          type="button"
          onClick={clearChecked}
          disabled={!hasChecked}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-40"
        >
          Clear checked
        </button>
      </div>

      {grouped.length === 0 ? (
        <p className="mt-16 text-center text-base text-ink/50">
          Your list is empty. Add items in Plan mode.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.category}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/50">
                {CATEGORY_LABELS[group.category]}
              </h2>
              <ul className="overflow-hidden rounded-xl bg-white shadow-sm">
                {group.items.map((item) => (
                  <li key={item.id} className="border-b border-gray-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left ${
                        item.checked ? 'bg-gray-50' : ''
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                          item.checked ? 'border-accent bg-accent text-white' : 'border-gray-300'
                        }`}
                      >
                        {item.checked && <Check size={18} strokeWidth={3} />}
                      </span>
                      <span
                        className={`flex-1 text-lg ${
                          item.checked ? 'text-ink/35 line-through' : 'text-ink'
                        }`}
                      >
                        {item.name}
                      </span>
                      {(item.amount || item.unit) && (
                        <span
                          className={`shrink-0 text-base ${
                            item.checked ? 'text-ink/30' : 'text-ink/50'
                          }`}
                        >
                          {[item.amount, item.unit].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
