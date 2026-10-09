// The scalloped sunburst that holds each app's emoji: the family's shared mark.

function scallop(points: number, r: number, depth: number): string {
  const steps = 240;
  const coords: string[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * Math.PI * 2;
    const rr = r + depth * Math.cos(points * t);
    coords.push(`${(50 + rr * Math.cos(t)).toFixed(2)} ${(50 + rr * Math.sin(t)).toFixed(2)}`);
  }
  return `M${coords.join(' L')}Z`;
}

const PATH = scallop(12, 44, 4.2);

interface SealProps {
  emoji: string;
  /** Pixel size of the seal. */
  size: number;
  /** Fill: the app's accent, or the family sun. */
  tone: 'accent' | 'sun';
  label?: string;
  /** Two emoji side by side get a smaller face. */
  pair?: boolean;
}

export function Seal({ emoji, size, tone, label, pair }: SealProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size, transform: 'rotate(var(--tilt))' }}
    >
      <svg viewBox="0 0 100 100" className="seal-turn absolute inset-0 h-full w-full overflow-visible">
        <path className="seal-shadow" d={PATH} />
        <path className={`seal-path ${tone === 'sun' ? 'fill-sun' : 'fill-accent'}`} d={PATH} />
      </svg>
      <span
        className="relative leading-none"
        style={{ fontSize: size * (pair ? 0.34 : 0.5), letterSpacing: pair ? '-0.1em' : undefined }}
      >
        {emoji}
      </span>
    </span>
  );
}
