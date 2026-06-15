interface PillToggleOption {
  label: string;
  value: string;
}

interface PillToggleProps {
  options: PillToggleOption[];
  value: string;
  onChange: (value: string) => void;
}

export function PillToggle({ options, value, onChange }: PillToggleProps) {
  return (
    <div className="inline-flex rounded-full bg-surface-variant p-1">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              isActive ? 'bg-accent text-white shadow-sm' : 'text-ink-variant'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
