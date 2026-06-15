import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface ListItem {
  id: string;
  text: string;
}

interface ItemListSectionProps {
  title: string;
  items: ListItem[];
  onRemove: (id: string) => void;
  onAdd: (text: string) => void;
  addPlaceholder?: string;
  emptyText?: string;
}

export function ItemListSection({
  title,
  items,
  onRemove,
  onAdd,
  addPlaceholder = 'Add item',
  emptyText,
}: ItemListSectionProps) {
  const [draft, setDraft] = useState('');

  function submitAdd() {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
  }

  return (
    <section>
      <h2 className="label-section mb-2">{title}</h2>

      {items.length === 0 && emptyText ? (
        <p className="card px-4 py-3 text-sm text-ink-variant">{emptyText}</p>
      ) : items.length > 0 ? (
        <ul className="card overflow-hidden">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 border-b border-outline/60 px-4 py-2.5 last:border-b-0"
            >
              <span className="flex-1 text-sm text-ink">{item.text}</span>
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
    </section>
  );
}
