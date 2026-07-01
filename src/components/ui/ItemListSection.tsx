import { useState } from 'react';
import { ShoppingCart, X } from 'lucide-react';
import {
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABELS,
  type GroceryCategory,
  type SupplyItem,
} from '../../types';
import { BottomSheet } from './BottomSheet';
import { CategoryIcon } from './CategoryIcon';

interface ItemListSectionProps {
  title?: string;
  accent?: string;
  items: SupplyItem[];
  onRemove: (id: string) => void;
  onMoveToList?: (id: string) => void;
  onCategoryChange?: (id: string, category: GroceryCategory) => void;
  emptyText?: string;
}

export function ItemListSection({
  title,
  accent,
  items,
  onRemove,
  onMoveToList,
  onCategoryChange,
  emptyText,
}: ItemListSectionProps) {
  const [categoryPickerId, setCategoryPickerId] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) =>
    a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }),
  );

  function selectCategory(category: GroceryCategory) {
    if (categoryPickerId) onCategoryChange?.(categoryPickerId, category);
    setCategoryPickerId(null);
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
          {sorted.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 border-b border-outline/60 px-4 py-2.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{item.text}</span>
              {onMoveToList && (
                <button
                  type="button"
                  onClick={() => onMoveToList(item.id)}
                  aria-label={`Add ${item.text} to grocery list`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-variant active:bg-surface-variant"
                >
                  <ShoppingCart size={16} />
                </button>
              )}
              {onCategoryChange && (
                <button
                  type="button"
                  onClick={() => setCategoryPickerId(item.id)}
                  aria-label={`Category: ${GROCERY_CATEGORY_LABELS[item.category ?? 'other']}`}
                  className={`chip-${item.category ?? 'other'} flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:opacity-70`}
                >
                  <CategoryIcon category={item.category ?? 'other'} size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.text}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-variant active:bg-surface-variant"
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <BottomSheet
        isOpen={categoryPickerId !== null}
        onClose={() => setCategoryPickerId(null)}
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
