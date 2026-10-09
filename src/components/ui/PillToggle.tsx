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
    <div className="inline-flex rounded-full border-[1.5px] border-outline bg-surface p-1">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              isActive ? 'bg-accent text-white' : 'text-ink-variant'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
