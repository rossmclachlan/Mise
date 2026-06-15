import { useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowLeft, Pencil, Plus, X } from 'lucide-react';
import {
  CATEGORY_LABELS,
  GROCERY_CATEGORIES,
  type GroceryCategory,
  type Staple,
} from '../../types';
import { BottomSheet } from '../ui/BottomSheet';

interface StaplesManagerProps {
  staples: Staple[];
  setStaples: Dispatch<SetStateAction<Staple[]>>;
  onBack: () => void;
}

interface StapleForm {
  name: string;
  amount: string;
  unit: string;
  category: GroceryCategory;
}

const EMPTY_FORM: StapleForm = { name: '', amount: '', unit: '', category: 'produce' };

const inputClass =
  'rounded-lg border border-gray-200 px-3 py-2 text-base focus:border-accent focus:outline-none';

export function StaplesManager({ staples, setStaples, onBack }: StaplesManagerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StapleForm>(EMPTY_FORM);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSheetOpen(true);
  }

  function openEdit(staple: Staple) {
    setEditingId(staple.id);
    setForm({
      name: staple.name,
      amount: staple.amount ?? '',
      unit: staple.unit ?? '',
      category: staple.category,
    });
    setSheetOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const data: Omit<Staple, 'id'> = {
      name: form.name.trim(),
      amount: form.amount.trim() || undefined,
      unit: form.unit.trim() || undefined,
      category: form.category,
    };

    if (editingId) {
      setStaples((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, ...data } : s)),
      );
    } else {
      setStaples((prev) => [...prev, { id: crypto.randomUUID(), ...data }]);
    }

    setSheetOpen(false);
  }

  function handleRemove(id: string) {
    setStaples((prev) => prev.filter((s) => s.id !== id));
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

      <h1 className="mb-4 text-2xl font-bold">Staples</h1>

      {staples.length === 0 ? (
        <p className="mt-16 text-center text-sm text-ink/50">
          No staples yet. Add items you always need on hand.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm">
          {staples.map((staple) => (
            <li key={staple.id} className="flex items-center gap-3 px-3 py-3">
              <button
                type="button"
                onClick={() => openEdit(staple)}
                className="flex flex-1 items-center justify-between gap-3 text-left"
              >
                <div className="text-sm">
                  <span className="font-medium">{staple.name}</span>
                  {(staple.amount || staple.unit) && (
                    <span className="ml-2 text-ink/50">
                      {[staple.amount, staple.unit].filter(Boolean).join(' ')}
                    </span>
                  )}
                  <span className="ml-2 text-xs uppercase tracking-wide text-ink/30">
                    {CATEGORY_LABELS[staple.category]}
                  </span>
                </div>
                <Pencil size={16} className="shrink-0 text-ink/30" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(staple.id)}
                aria-label={`Remove ${staple.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/40"
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={openAdd}
        aria-label="Add staple"
        className="absolute bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      >
        <Plus size={28} />
      </button>

      <BottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? 'Edit Staple' : 'Add Staple'}
      >
        <div className="flex flex-col gap-4 pb-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink/70">Name</span>
            <input
              type="text"
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Olive oil"
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
                placeholder="1"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-ink/70">Unit</span>
              <input
                type="text"
                className={inputClass}
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="bottle"
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
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="mt-2 w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-40"
          >
            {editingId ? 'Save Changes' : 'Add Staple'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
