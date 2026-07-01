import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, Plus, Warehouse, X } from 'lucide-react';
import {
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABELS,
  type CostcoItem,
  type GroceryCategory,
  type GroceryItem,
  type Staple,
  type SupplyItem,
} from '../../types';
import { categoriseItem, learnCategory } from '../../utils/categorise';
import { useWakeLock } from '../../hooks/useWakeLock';
import { BottomSheet } from '../ui/BottomSheet';
import { CATEGORY_ACCENT } from '../ui/categoryVisuals';
import { CategoryIcon } from '../ui/CategoryIcon';
import { ChecklistSection, type ChecklistItem } from '../ui/ChecklistSection';
import { ItemListSection } from '../ui/ItemListSection';

type AddTarget = 'grocery' | 'staple' | 'supplies';

const ADD_TARGET_LABELS: Record<AddTarget, string> = {
  grocery: 'Grocery',
  staple: 'Staple',
  supplies: 'Supplies',
};

interface GroceryViewProps {
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
  staples: Staple[];
  setStaples: Dispatch<SetStateAction<Staple[]>>;
  supplies: SupplyItem[];
  setSupplies: Dispatch<SetStateAction<SupplyItem[]>>;
  costco: CostcoItem[];
  setCostco: Dispatch<SetStateAction<CostcoItem[]>>;
}

export function GroceryView({
  groceryList,
  setGroceryList,
  staples,
  setStaples,
  supplies,
  setSupplies,
  costco,
  setCostco,
}: GroceryViewProps) {
  useWakeLock(true);

  const [costcoOpen, setCostcoOpen] = useState(false);
  const [addBarOpen, setAddBarOpen] = useState(false);
  const draftInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [addTarget, setAddTarget] = useState<AddTarget>('grocery');
  const [draftCategory, setDraftCategory] = useState<GroceryCategory | null>(null);
  const [draftCategoryOverride, setDraftCategoryOverride] = useState<GroceryCategory | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  useEffect(() => {
    if (addBarOpen) draftInputRef.current?.focus();
  }, [addBarOpen]);

  useEffect(() => {
    if (addTarget !== 'grocery') return;
    const text = draft.trim();
    const handle = setTimeout(() => setDraftCategory(text ? categoriseItem(text) : null), 300);
    return () => clearTimeout(handle);
  }, [draft, addTarget]);

  const effectiveDraftCategory = draftCategoryOverride ?? draftCategory ?? 'other';

  const hasChecked =
    groceryList.some((item) => item.checked) || staples.some((staple) => staple.checked);

  function submitAdd() {
    const text = draft.trim();
    if (!text) return;
    if (addTarget === 'grocery') {
      setGroceryList((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, checked: false, category: effectiveDraftCategory },
      ]);
    } else if (addTarget === 'staple') {
      setStaples((prev) => [...prev, { id: crypto.randomUUID(), text, checked: false }]);
    } else {
      setSupplies((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text, category: categoriseItem(text) },
      ]);
    }
    setDraft('');
    setDraftCategory(null);
    setDraftCategoryOverride(null);
  }

  function toggleItem(id: string) {
    setGroceryList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  }

  function removeItem(id: string) {
    setGroceryList((prev) => prev.filter((item) => item.id !== id));
  }

  function editItemText(id: string, text: string) {
    setGroceryList((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
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

  function editStapleText(id: string, text: string) {
    setStaples((prev) => prev.map((staple) => (staple.id === id ? { ...staple, text } : staple)));
  }

  function toggleCostcoItem(id: string) {
    setCostco((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  }

  function removeCostcoItem(id: string) {
    setCostco((prev) => prev.filter((item) => item.id !== id));
  }

  function editCostcoItemText(id: string, text: string) {
    setCostco((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  }

  function addCostcoItem(text: string, category?: GroceryCategory) {
    setCostco((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, checked: false, category: category ?? categoriseItem(text) },
    ]);
  }

  function changeCostcoItemCategory(id: string, category: GroceryCategory) {
    setCostco((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        learnCategory(item.text, category);
        return { ...item, category };
      }),
    );
  }

  function clearChecked() {
    setGroceryList((prev) => prev.filter((item) => !item.checked));
    setStaples((prev) => prev.map((staple) => ({ ...staple, checked: false })));
  }

  function removeSupplyItem(id: string) {
    setSupplies((prev) => prev.filter((item) => item.id !== id));
  }

  function changeSupplyCategory(id: string, category: GroceryCategory) {
    setSupplies((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        learnCategory(item.text, category);
        return { ...item, category };
      }),
    );
  }

  function moveGroceryItemToSupplies(item: ChecklistItem) {
    setSupplies((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: item.text,
        category: item.category ?? categoriseItem(item.text),
      },
    ]);
    setGroceryList((prev) => prev.filter((i) => i.id !== item.id));
  }

  function moveSupplyItemToList(id: string) {
    const item = supplies.find((s) => s.id === id);
    if (!item) return;
    setGroceryList((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: item.text,
        checked: false,
        category: item.category ?? categoriseItem(item.text),
      },
    ]);
    setSupplies((prev) => prev.filter((s) => s.id !== id));
  }

  const groceryByCategory = GROCERY_CATEGORIES.map((category) => ({
    category,
    items: groceryList.filter((item) => (item.category ?? 'other') === category),
  })).filter((group) => group.items.length > 0);

  const suppliesByCategory = GROCERY_CATEGORIES.map((category) => ({
    category,
    items: supplies.filter((item) => (item.category ?? 'other') === category),
  })).filter((group) => group.items.length > 0);

  const costcoByCategory = GROCERY_CATEGORIES.map((category) => ({
    category,
    items: costco.filter((item) => (item.category ?? 'other') === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="relative h-full overflow-hidden">
      <div className="h-full overflow-y-auto px-4 pb-40 pt-4">
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
          {staples.length > 0 && (
            <ChecklistSection
              title="Staples"
              items={staples}
              onToggle={toggleStaple}
              onRemove={removeStaple}
              onEdit={editStapleText}
              emptyText="No staples yet."
              large
            />
          )}

          {groceryByCategory.map(({ category, items }) => (
            <ChecklistSection
              key={category}
              title={GROCERY_CATEGORY_LABELS[category]}
              accent={CATEGORY_ACCENT[category]}
              items={items}
              onToggle={toggleItem}
              onRemove={removeItem}
              onEdit={editItemText}
              onCategoryChange={changeItemCategory}
              onStock={moveGroceryItemToSupplies}
              large
              supplyItems={supplies}
            />
          ))}

          {supplies.length > 0 && <h1 className="text-2xl font-bold">Supplies</h1>}

          {suppliesByCategory.map(({ category, items }) => (
            <ItemListSection
              key={category}
              title={GROCERY_CATEGORY_LABELS[category]}
              accent={CATEGORY_ACCENT[category]}
              items={items}
              onRemove={removeSupplyItem}
              onMoveToList={moveSupplyItemToList}
              onCategoryChange={changeSupplyCategory}
            />
          ))}

          <div className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setCostcoOpen((prev) => !prev)}
              aria-expanded={costcoOpen}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Warehouse size={16} />
                Costco list{costco.length > 0 ? ` (${costco.length})` : ''}
              </span>
              <ChevronDown size={18} className={`transition-transform ${costcoOpen ? 'rotate-180' : ''}`} />
            </button>

            {costcoOpen && (
              <div className="space-y-4 border-t border-outline/60 px-3 pb-3 pt-3">
                {costcoByCategory.map(({ category, items }) => (
                  <ChecklistSection
                    key={category}
                    title={GROCERY_CATEGORY_LABELS[category]}
                    accent={CATEGORY_ACCENT[category]}
                    items={items}
                    onToggle={toggleCostcoItem}
                    onRemove={removeCostcoItem}
                    onEdit={editCostcoItemText}
                    onCategoryChange={changeCostcoItemCategory}
                  />
                ))}
                <ChecklistSection
                  items={[]}
                  onToggle={toggleCostcoItem}
                  onAdd={addCostcoItem}
                  showCategoryPreview
                  addPlaceholder="Add a Costco item"
                  emptyText={costco.length === 0 ? 'No Costco items yet.' : undefined}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {addBarOpen ? (
        <div className="absolute inset-x-0 bottom-0 z-30 border-t border-outline bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-2px_12px_rgba(28,20,5,0.06)]">
          <div className="mb-1 flex items-center justify-between">
            <span className="label-section">Add item</span>
            <button
              type="button"
              onClick={() => setAddBarOpen(false)}
              aria-label="Close"
              className="rounded-full p-1 text-ink-variant active:bg-surface-variant"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              ref={draftInputRef}
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDraftCategoryOverride(null);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(); }}
              placeholder={
                addTarget === 'grocery'
                  ? 'Add grocery item'
                  : addTarget === 'staple'
                    ? 'Add a staple'
                    : 'Add a supplies item'
              }
              className="input-field flex-1"
            />
            <button
              type="button"
              onClick={submitAdd}
              disabled={!draft.trim()}
              aria-label="Add item"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-accent text-white transition active:opacity-90 disabled:opacity-40"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            {(['grocery', 'staple', 'supplies'] as const).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setAddTarget(target)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  addTarget === target
                    ? 'bg-accent text-white'
                    : 'bg-surface-variant text-ink-variant'
                }`}
              >
                {ADD_TARGET_LABELS[target]}
              </button>
            ))}
          </div>

          {addTarget === 'grocery' && draft.trim() && (
            <div className="mt-2 px-1">
              <button
                type="button"
                onClick={() => setCategoryPickerOpen(true)}
                className={`chip-${effectiveDraftCategory} inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold`}
              >
                <CategoryIcon category={effectiveDraftCategory} size={12} />
                {GROCERY_CATEGORY_LABELS[effectiveDraftCategory]}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddBarOpen(true)}
          aria-label="Add item"
          className="fab absolute bottom-4 right-4 z-30"
        >
          <Plus size={28} />
        </button>
      )}

      <BottomSheet
        isOpen={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        title="Category"
      >
        <ul className="divide-y divide-outline/60">
          {GROCERY_CATEGORIES.map((category) => (
            <li key={category}>
              <button
                type="button"
                onClick={() => {
                  setDraftCategoryOverride(category);
                  setCategoryPickerOpen(false);
                }}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span
                  className={`chip-${category} flex h-9 w-9 shrink-0 items-center justify-center rounded-full`}
                >
                  <CategoryIcon category={category} size={18} />
                </span>
                <span className="text-base font-medium">{GROCERY_CATEGORY_LABELS[category]}</span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}
