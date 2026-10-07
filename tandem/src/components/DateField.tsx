import { X } from 'lucide-react';
import type { DateString } from '../types';

/** A labelled date input that can be cleared. */
export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: DateString | null;
  onChange: (v: DateString | null) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-section">{label}</span>
      <span className="relative flex items-center">
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={`input-field w-full min-w-0 py-2 text-[15px] ${value ? 'pr-9' : ''}`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Clear ${label}`}
            className="absolute right-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-variant active:bg-surface-variant"
          >
            <X size={16} />
          </button>
        )}
      </span>
      {hint && <span className="text-xs text-ink-variant">{hint}</span>}
    </label>
  );
}
