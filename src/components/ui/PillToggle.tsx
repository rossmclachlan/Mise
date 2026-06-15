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
    <div className="inline-flex rounded-full bg-gray-100 p-1">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-accent text-white' : 'text-ink/60'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
