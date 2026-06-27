import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Archive,
  Beef,
  Carrot,
  ChevronDown,
  Croissant,
  CupSoda,
  Fish,
  Milk,
  Plus,
  Snowflake,
  Tag,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABELS,
  type CostcoItem,
  type FreezerItem,
  type GroceryCategory,
  type GroceryItem,
  type PantryItem,
  type Staple,
} from '../../types';
import { categoriseItem, learnCategory } from '../../utils/categorise';
import { useWakeLock } from '../../hooks/useWakeLock';
import { BottomSheet } from '../ui/BottomSheet';
import { ChecklistSection, type ChecklistItem } from '../ui/ChecklistSection';
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

const CATEGORY_ICONS: Record<GroceryCategory, LucideIcon> = {
  produce: Carrot,
  dairy: Milk,
  meat: Beef,
  fish: Fish,
  bakery: Croissant,
  pantry: Archive,
  frozen: Snowflake,
  drinks: CupSoda,
  other: Tag,
};

// "Already have it" inventory sections borrow the Pantry/Frozen chip colors
// so they read as visually distinct from the buy-list above them.
const PANTRY_TINT = '#EDE9FE';
const FREEZER_TINT = '#E0F2FE';

function CategoryIcon({ category, size }: { category: GroceryCategory; size: number }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon size={size} />;
}

type AddTarget = 'grocery' | 'staple' | 'pantry' | 'freezer';

const ADD_TARGET_LABELS: Record<AddTarget, string> = {
  grocery: 'Grocery',
  staple: 'Staple',
  pantry: 'Pantry',
  freezer: 'Freezer',
};

interface GroceryViewProps {
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
  staples: Staple[];
  setStaples: Dispatch<SetStateAction<Staple[]>>;
  pantry: PantryItem[];
  setPantry: Dispatch<SetStateAction<PantryItem[]>>;
  freezer: FreezerItem[];
  setFreezer: Dispatch<SetStateAction<FreezerItem[]>>;
  costco: CostcoItem[];
  setCostco: Dispatch<SetStateAction<CostcoItem[]>>;
}

export function GroceryView({
  groceryList,
  setGroceryList,
  staples,
  setStaples,
  pantry,
  setPantry,
  freezer,
  setFreezer,
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
    } else if (addTarget === 'pantry') {
      setPantry((prev) => [...prev, { id: crypto.randomUUID(), text }]);
    } else {
      setFreezer((prev) => [...prev, { id: crypto.randomUUID(), text }]);
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

  function addCostcoItem(text: string) {
    setCostco((prev) => [...prev, { id: crypto.randomUUID(), text, checked: false }]);
  }

  function clearChecked() {
    setGroceryList((prev) => prev.filter((item) => !item.checked));
    setStaples((prev) => prev.map((staple) => ({ ...staple, checked: false })));
  }

  function removePantryItem(id: string) {
    setPantry((prev) => prev.filter((item) => item.id !== id));
  }

  function removeFreezerItem(id: string) {
    setFreezer((prev) => prev.filter((item) => item.id !== id));
  }

  function moveGroceryItemToSupplies(item: ChecklistItem) {
    if (item.category === 'frozen') {
      setFreezer((prev) => [...prev, { id: crypto.randomUUID(), text: item.text }]);
    } else {
      setPantry((prev) => [...prev, { id: crypto.randomUUID(), text: item.text }]);
    }
    setGroceryList((prev) => prev.filter((i) => i.id !== item.id));
  }

  function movePantryItemToList(id: string) {
    const item = pantry.find((p) => p.id === id);
    if (!item) return;
    setGroceryList((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: item.text, checked: false, category: categoriseItem(item.text) },
    ]);
    setPantry((prev) => prev.filter((p) => p.id !== id));
  }

  function moveFreezerItemToList(id: string) {
    const item = freezer.find((f) => f.id === id);
    if (!item) return;
    setGroceryList((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: item.text, checked: false, category: 'frozen' },
    ]);
    setFreezer((prev) => prev.filter((f) => f.id !== id));
  }

  const groceryByCategory = GROCERY_CATEGORIES.map((category) => ({
    category,
    items: groceryList.filter((item) => (item.category ?? 'other') === category),
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
              pantryItems={pantry}
              freezerItems={freezer}
            />
          ))}

          {(pantry.length > 0 || freezer.length > 0) && (
            <h1 className="text-2xl font-bold">Supplies</h1>
          )}

          {pantry.length > 0 && (
            <ItemListSection
              title="Pantry"
              items={pantry}
              onRemove={removePantryItem}
              onMoveToList={movePantryItemToList}
              emptyText="No pantry items yet."
              accent={CATEGORY_ACCENT.pantry}
              tint={PANTRY_TINT}
              icon={CATEGORY_ICONS.pantry}
            />
          )}

          {freezer.length > 0 && (
            <ItemListSection
              title="Freezer"
              items={freezer}
              onRemove={removeFreezerItem}
              onMoveToList={moveFreezerItemToList}
              emptyText="No freezer items yet."
              accent={CATEGORY_ACCENT.frozen}
              tint={FREEZER_TINT}
              icon={CATEGORY_ICONS.frozen}
            />
          )}

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
              <div className="border-t border-outline/60 px-3 pb-3 pt-3">
                <ChecklistSection
                  items={costco}
                  onToggle={toggleCostcoItem}
                  onRemove={removeCostcoItem}
                  onEdit={editCostcoItemText}
                  onAdd={addCostcoItem}
                  addPlaceholder="Add a Costco item"
                  emptyText="No Costco items yet."
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
                    : addTarget === 'pantry'
                      ? 'Add a pantry item'
                      : 'Add a freezer item'
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
            {(['grocery', 'staple', 'pantry', 'freezer'] as const).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setAddTarget(target)}
                style={
                  addTarget === target && target === 'pantry'
                    ? { backgroundColor: CATEGORY_ACCENT.pantry }
                    : addTarget === target && target === 'freezer'
                      ? { backgroundColor: CATEGORY_ACCENT.frozen }
                      : undefined
                }
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
