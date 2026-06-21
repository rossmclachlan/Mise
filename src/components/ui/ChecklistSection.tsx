import { useEffect, useState } from 'react';
import {
  Archive,
  Beef,
  Carrot,
  Check,
  Croissant,
  CupSoda,
  Fish,
  Milk,
  Package,
  Pencil,
  Plus,
  Snowflake,
  Tag,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABELS,
  type FreezerItem,
  type GroceryCategory,
  type PantryItem,
} from '../../types';
import { categoriseItem } from '../../utils/categorise';
import { BottomSheet } from './BottomSheet';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  category?: GroceryCategory;
}

interface ChecklistSectionProps {
  title?: string;
  accent?: string;
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  onRemove?: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
  onAdd?: (text: string, category?: GroceryCategory) => void;
  onCategoryChange?: (id: string, category: GroceryCategory) => void;
  showCategoryPreview?: boolean;
  addPlaceholder?: string;
  emptyText?: string;
  large?: boolean;
  pantryItems?: PantryItem[];
  freezerItems?: FreezerItem[];
}

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

function CategoryIcon({ category, size }: { category: GroceryCategory; size: number }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon size={size} />;
}

type CategoryPickerTarget = { type: 'item'; id: string } | { type: 'draft' };

export function ChecklistSection({
  title,
  accent,
  items,
  onToggle,
  onRemove,
  onEdit,
  onAdd,
  onCategoryChange,
  showCategoryPreview,
  addPlaceholder = 'Add item',
  emptyText,
  large,
  pantryItems,
  freezerItems,
}: ChecklistSectionProps) {
  const [draft, setDraft] = useState('');
  const [draftCategory, setDraftCategory] = useState<GroceryCategory | null>(null);
  const [draftCategoryOverride, setDraftCategoryOverride] = useState<GroceryCategory | null>(null);
  const [categoryPickerTarget, setCategoryPickerTarget] = useState<CategoryPickerTarget | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const sorted = [...items].sort((a, b) => Number(a.checked) - Number(b.checked));

  useEffect(() => {
    if (!showCategoryPreview) return;
    const text = draft.trim();
    if (!text) return;
    const handle = setTimeout(() => setDraftCategory(categoriseItem(text)), 300);
    return () => clearTimeout(handle);
  }, [draft, showCategoryPreview]);

  const effectiveDraftCategory = draftCategoryOverride ?? draftCategory ?? 'other';

  function submitAdd() {
    const text = draft.trim();
    if (!text) return;
    onAdd?.(text, showCategoryPreview ? effectiveDraftCategory : undefined);
    setDraft('');
    setDraftCategory(null);
    setDraftCategoryOverride(null);
  }

  function isInPantry(item: ChecklistItem): boolean {
    if (!pantryItems?.length) return false;
    const text = item.text.toLowerCase();
    return pantryItems.some((p) => p.text.trim() && text.includes(p.text.toLowerCase()));
  }

  function isInFreezer(item: ChecklistItem): boolean {
    if (!freezerItems?.length) return false;
    const text = item.text.toLowerCase();
    return freezerItems.some((f) => f.text.trim() && text.includes(f.text.toLowerCase()));
  }

  function startEdit(item: ChecklistItem) {
    setEditingId(item.id);
    setEditText(item.text);
  }

  function commitEdit() {
    const text = editText.trim();
    if (editingId && text) onEdit?.(editingId, text);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function selectCategory(category: GroceryCategory) {
    if (categoryPickerTarget?.type === 'item') {
      onCategoryChange?.(categoryPickerTarget.id, category);
    } else if (categoryPickerTarget?.type === 'draft') {
      setDraftCategoryOverride(category);
    }
    setCategoryPickerTarget(null);
  }

  return (
    <section>
      {title && (
        <h2 className="label-section mb-2" style={accent ? { color: accent } : undefined}>
          {title}
        </h2>
      )}

      {sorted.length === 0 && emptyText ? (
        <p className="card px-4 py-3 text-sm text-ink-variant">{emptyText}</p>
      ) : sorted.length > 0 ? (
        <ul className="card overflow-hidden">
          {sorted.map((item) => {
            const editing = editingId === item.id;
            return (
              <li
                key={item.id}
                className="flex items-center border-b border-outline/60 last:border-b-0"
              >
                {editing ? (
                  <div
                    className={`flex flex-1 items-center gap-3 px-4 ${
                      large ? 'min-h-[56px] py-3' : 'py-2.5'
                    }`}
                  >
                    <span
                      className={`checkbox-indicator ${large ? 'h-7 w-7' : 'h-5 w-5'} ${
                        item.checked ? 'border-accent bg-accent text-white' : 'border-outline'
                      }`}
                    >
                      {item.checked && <Check size={large ? 18 : 14} strokeWidth={3} />}
                    </span>
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      onBlur={commitEdit}
                      autoFocus
                      className={`input-field flex-1 ${large ? 'text-lg' : 'text-sm'}`}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className={`flex flex-1 items-center gap-3 px-4 text-left ${
                      large ? 'min-h-[56px] py-3' : 'py-2.5'
                    } ${item.checked ? 'bg-surface-variant/60' : ''}`}
                  >
                    <span
                      className={`checkbox-indicator ${large ? 'h-7 w-7' : 'h-5 w-5'} ${
                        item.checked ? 'border-accent bg-accent text-white' : 'border-outline'
                      }`}
                    >
                      {item.checked && <Check size={large ? 18 : 14} strokeWidth={3} />}
                    </span>
                    <span className="flex flex-1 items-center gap-2 overflow-hidden">
                      <span
                        className={`truncate ${large ? 'text-lg' : 'text-sm'} ${
                          item.checked ? 'text-ink-variant line-through' : 'text-ink'
                        }`}
                      >
                        {item.text}
                      </span>
                      {isInPantry(item) && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: '#EDE9FE', color: '#4C1D95' }}
                        >
                          <Package size={10} /> In Pantry
                        </span>
                      )}
                      {isInFreezer(item) && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: '#E0F2FE', color: '#0C4A6E' }}
                        >
                          <Snowflake size={10} /> In Freezer
                        </span>
                      )}
                    </span>
                  </button>
                )}
                {!editing && onEdit && (
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    aria-label={`Edit ${item.text}`}
                    className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-variant active:bg-surface-variant"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {!editing && onCategoryChange && (
                  <button
                    type="button"
                    onClick={() => setCategoryPickerTarget({ type: 'item', id: item.id })}
                    aria-label={`Category: ${GROCERY_CATEGORY_LABELS[item.category ?? 'other']}`}
                    className={`chip-${item.category ?? 'other'} mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:opacity-70`}
                  >
                    <CategoryIcon category={item.category ?? 'other'} size={large ? 16 : 14} />
                  </button>
                )}
                {!editing && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remove ${item.text}`}
                    className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-variant active:bg-surface-variant"
                  >
                    <X size={18} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {onAdd && (
        <div className="mt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDraftCategoryOverride(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAdd();
              }}
              placeholder={addPlaceholder}
              className="input-field flex-1"
            />
            <button
              type="button"
              onClick={submitAdd}
              disabled={!draft.trim()}
              aria-label={`Add ${title ? `to ${title}` : 'item'}`}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-accent text-white transition active:opacity-90 disabled:opacity-40"
            >
              <Plus size={20} />
            </button>
          </div>
          {showCategoryPreview && draft.trim() && (
            <div className="mt-2 px-1">
              <button
                type="button"
                onClick={() => setCategoryPickerTarget({ type: 'draft' })}
                className={`chip-${effectiveDraftCategory} inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold`}
              >
                <CategoryIcon category={effectiveDraftCategory} size={12} />
                {GROCERY_CATEGORY_LABELS[effectiveDraftCategory]}
              </button>
            </div>
          )}
        </div>
      )}

      <BottomSheet
        isOpen={categoryPickerTarget !== null}
        onClose={() => setCategoryPickerTarget(null)}
        title="Category"
      >
        <ul className="divide-y divide-outline/60">
          {GROCERY_CATEGORIES.map((category) => (
            <li key={category}>
              <button
                type="button"
                onClick={() => selectCategory(category)}
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
    </section>
  );
}
