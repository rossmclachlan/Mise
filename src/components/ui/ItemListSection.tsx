import { useState } from 'react';
import { Plus, ShoppingCart, X, type LucideIcon } from 'lucide-react';

export interface ListItem {
  id: string;
  text: string;
}

interface ItemListSectionProps {
  title: string;
  items: ListItem[];
  onRemove: (id: string) => void;
  onAdd?: (text: string) => void;
  onMoveToList?: (id: string) => void;
  addPlaceholder?: string;
  emptyText?: string;
  /** Title + icon color, to visually set this section apart from the buy-list. */
  accent?: string;
  /** Card background tint, to visually set this section apart from the buy-list. */
  tint?: string;
  icon?: LucideIcon;
}

export function ItemListSection({
  title,
  items,
  onRemove,
  onAdd,
  onMoveToList,
  addPlaceholder = 'Add item',
  emptyText,
  accent,
  tint,
  icon: Icon,
}: ItemListSectionProps) {
  const [draft, setDraft] = useState('');

  const sorted = [...items].sort((a, b) =>
    a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }),
  );

  function submitAdd() {
    const text = draft.trim();
    if (!text) return;
    onAdd?.(text);
    setDraft('');
  }

  return (
    <section>
      <h2 className="label-section mb-2" style={accent ? { color: accent } : undefined}>
        {title}
      </h2>

      {sorted.length === 0 && emptyText ? (
        <p className="card px-4 py-3 text-sm text-ink-variant">{emptyText}</p>
      ) : sorted.length > 0 ? (
        <ul
          className="overflow-hidden rounded-2xl shadow-[0_1px_3px_rgba(28,20,5,0.08),0_2px_12px_rgba(28,20,5,0.05)]"
          style={{ backgroundColor: tint ?? 'var(--color-surface)' }}
        >
          {sorted.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 border-b border-outline/60 px-4 py-2.5 last:border-b-0"
            >
              <span className="flex flex-1 items-center gap-2 text-sm text-ink">
                {Icon && <Icon size={14} className="shrink-0" style={accent ? { color: accent } : undefined} />}
                {item.text}
              </span>
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
            aria-label={`Add to ${title}`}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-accent text-white transition active:opacity-90 disabled:opacity-40"
          >
            <Plus size={20} />
          </button>
        </div>
      )}
    </section>
  );
}
