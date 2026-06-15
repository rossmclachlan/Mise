import { useState } from 'react';
import { Check, Package, Plus, X } from 'lucide-react';
import type { PantryItem } from '../../types';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface ChecklistSectionProps {
  title?: string;
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  onRemove?: (id: string) => void;
  onAdd?: (text: string) => void;
  addPlaceholder?: string;
  emptyText?: string;
  large?: boolean;
  pantryItems?: PantryItem[];
}

export function ChecklistSection({
  title,
  items,
  onToggle,
  onRemove,
  onAdd,
  addPlaceholder = 'Add item',
  emptyText,
  large,
  pantryItems,
}: ChecklistSectionProps) {
  const [draft, setDraft] = useState('');

  const sorted = [...items].sort((a, b) => Number(a.checked) - Number(b.checked));

  function submitAdd() {
    const text = draft.trim();
    if (!text) return;
    onAdd?.(text);
    setDraft('');
  }

  function isInPantry(item: ChecklistItem): boolean {
    if (!pantryItems?.length) return false;
    const text = item.text.toLowerCase();
    return pantryItems.some((p) => p.text.trim() && text.includes(p.text.toLowerCase()));
  }

  return (
    <section>
      {title && <h2 className="label-section mb-2">{title}</h2>}

      {sorted.length === 0 && emptyText ? (
        <p className="card px-4 py-3 text-sm text-ink-variant">{emptyText}</p>
      ) : sorted.length > 0 ? (
        <ul className="card overflow-hidden">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="flex items-center border-b border-outline/60 last:border-b-0"
            >
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
                      aria-label="In pantry"
                      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-container p-1 text-on-accent-container"
                    >
                      <Package size={large ? 14 : 12} />
                    </span>
                  )}
                </span>
              </button>
              {onRemove && (
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
          ))}
        </ul>
      ) : null}

      {onAdd && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
      )}
    </section>
  );
}
