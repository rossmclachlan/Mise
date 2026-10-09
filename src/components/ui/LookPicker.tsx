import { useState } from 'react';
import { Seal } from './Seal';
import { getWhimsy, setWhimsy, type Whimsy } from './whimsy';

const LOOKS: { value: Whimsy; label: string; emoji: string; hint: string }[] = [
  { value: 'calm', label: 'Calm', emoji: '🌿', hint: 'Clean and quiet' },
  { value: 'sunny', label: 'Sunny', emoji: '☀️', hint: 'A little playful' },
  { value: 'wild', label: 'Wild', emoji: '🍄', hint: 'Everything on' },
];

/** The Look setting, for both apps' account menus. */
export function LookPicker() {
  const [look, setLook] = useState<Whimsy>(getWhimsy);

  function pick(v: Whimsy) {
    setWhimsy(v);
    setLook(v);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold text-ink-variant">Look</span>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Look">
        {LOOKS.map(({ value, label, emoji, hint }) => {
          const on = look === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(value)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2.5 text-center transition ${
                on ? 'border-2 border-ink bg-sun-container' : 'border-[1.5px] border-outline bg-bg'
              }`}
            >
              {/* A live preview: the look-* class sets that level's values locally. */}
              <span className={`look-${value} flex h-10 items-center gap-1.5`} aria-hidden>
                <Seal emoji={emoji} size={28} tone="sun" />
                <span className="sticker rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-white">Add</span>
              </span>
              <span className="text-sm font-extrabold text-ink">{label}</span>
              <span className="text-[11px] leading-tight text-ink-variant">{hint}</span>
            </button>
          );
        })}
      </div>
      <span className="text-xs text-ink-variant">Saved on this phone. Applies to Mise and Priorities.</span>
    </div>
  );
}
