import { useState, type Dispatch, type SetStateAction } from 'react';
import { Plus, Settings, X } from 'lucide-react';
import {
  CATEGORY_LABELS,
  GROCERY_CATEGORIES,
  type GroceryCategory,
  type GroceryItem,
  type Staple,
} from '../../types';
import { mergeStaplesIntoGroceryList } from '../../utils/dedupe';
import { BottomSheet } from '../ui/BottomSheet';

interface GroceryListViewProps {
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
  staples: Staple[];
  onManageStaples: () => void;
}

interface ItemForm {
  name: string;
  amount: string;
  unit: string;
  category: GroceryCategory;
}

const EMPTY_ITEM_FORM: ItemForm = { name: '', amount: '', unit: '', category: 'produce' };

const inputClass =
  'rounded-lg border border-gray-200 px-3 py-2 text-base focus:border-accent focus:outline-none';

export function GroceryListView({
  groceryList,
  setGroceryList,
  staples,
  onManageStaples,
}: GroceryListViewProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<ItemForm>(EMPTY_ITEM_FORM);

  const unchecked = groceryList.filter((item) => !item.checked);
  const grouped = GROCERY_CATEGORIES.map((category) => ({
    category,
    items: unchecked.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  function handleAddStaples() {
    setGroceryList((prev) => mergeStaplesIntoGroceryList(prev, staples));
  }

  function removeItem(id: string) {
    setGroceryList((prev) => prev.filter((item) => item.id !== id));
  }

  function handleAddItem() {
    if (!form.name.trim()) return;
    setGroceryList((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        amount: form.amount.trim() || undefined,
        unit: form.unit.trim() || undefined,
        category: form.category,
        checked: false,
      },
    ]);
    setForm(EMPTY_ITEM_FORM);
    setAddOpen(false);
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={handleAddStaples}
          className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold shadow-sm active:bg-gray-50"
        >
          Add Staples
        </button>
        <button
          type="button"
          onClick={onManageStaples}
          className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold shadow-sm active:bg-gray-50"
        >
          <Settings size={16} /> Staples
        </button>
      </div>

      {grouped.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink/50">
          Your grocery list is empty. Add items, staples, or ingredients from
          a recipe.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.category}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/40">
                {CATEGORY_LABELS[group.category]}
              </h2>
              <ul className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-3 py-3"
                  >
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{item.name}</span>
                      {(item.amount || item.unit) && (
                        <span className="ml-2 text-ink/50">
                          {[item.amount, item.unit].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/40"
                    >
                      <X size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Add item"
        className="absolute bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      >
        <Plus size={28} />
      </button>

      <BottomSheet isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Item">
        <div className="flex flex-col gap-4 pb-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink/70">Name</span>
            <input
              type="text"
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Lemons"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-ink/70">Amount</span>
              <input
                type="text"
                className={inputClass}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="2"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-ink/70">Unit</span>
              <input
                type="text"
                className={inputClass}
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="pcs"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink/70">Category</span>
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value as GroceryCategory }))
              }
            >
              {GROCERY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleAddItem}
            disabled={!form.name.trim()}
            className="mt-2 w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-40"
          >
            Add Item
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
