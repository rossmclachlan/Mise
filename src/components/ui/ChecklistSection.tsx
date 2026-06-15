import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface ChecklistSectionProps {
  title: string;
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  onRemove?: (id: string) => void;
  onAdd?: (text: string) => void;
  addPlaceholder?: string;
  emptyText?: string;
  large?: boolean;
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
}: ChecklistSectionProps) {
  const [draft, setDraft] = useState('');

  const sorted = [...items].sort((a, b) => Number(a.checked) - Number(b.checked));

  function submitAdd() {
    const text = draft.trim();
    if (!text) return;
    onAdd?.(text);
    setDraft('');
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/50">{title}</h2>

      {sorted.length === 0 && emptyText ? (
        <p className="rounded-xl bg-white px-4 py-3 text-sm text-ink/40 shadow-sm">{emptyText}</p>
      ) : sorted.length > 0 ? (
        <ul className="overflow-hidden rounded-xl bg-white shadow-sm">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="flex items-center border-b border-gray-100 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className={`flex flex-1 items-center gap-3 px-4 text-left ${
                  large ? 'min-h-[56px] py-3' : 'py-2.5'
                } ${item.checked ? 'bg-gray-50' : ''}`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center rounded-full border-2 ${
                    large ? 'h-7 w-7' : 'h-5 w-5'
                  } ${item.checked ? 'border-accent bg-accent text-white' : 'border-gray-300'}`}
                >
                  {item.checked && <Check size={large ? 18 : 14} strokeWidth={3} />}
                </span>
                <span
                  className={`flex-1 ${large ? 'text-lg' : 'text-sm'} ${
                    item.checked ? 'text-ink/35 line-through' : 'text-ink'
                  }`}
                >
                  {item.text}
                </span>
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.text}`}
                  className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/40"
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
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-base focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={submitAdd}
            disabled={!draft.trim()}
            aria-label={`Add to ${title}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40"
          >
            <Plus size={20} />
          </button>
        </div>
      )}
    </section>
  );
}
