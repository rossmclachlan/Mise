interface RecipeImageProps {
  src?: string;
  alt?: string;
  className?: string;
  iconSize?: number;
  /** The recipe's title: picks a steady emoji and plate colour when there's no photo. */
  seed?: string;
}

const PLATE_EMOJI = ['🍲', '🥘', '🍝', '🥗', '🍛', '🌮', '🥙', '🍜', '🫕', '🥧', '🍳', '🥪'];
const PLATE_BG = ['bg-accent-container', 'bg-second-container', 'bg-sun-container'];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function RecipeImage({ src, alt = '', className = '', iconSize = 28, seed }: RecipeImageProps) {
  if (src) {
    return <img src={src} alt={alt} className={`object-cover bg-surface-variant ${className}`} />;
  }

  const h = hash(seed ?? alt);
  return (
    <div
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      className={`flex items-center justify-center ${PLATE_BG[h % PLATE_BG.length]} ${className}`}
    >
      <span aria-hidden className="leading-none" style={{ fontSize: iconSize * 1.2 }}>
        {PLATE_EMOJI[h % PLATE_EMOJI.length]}
      </span>
    </div>
  );
}
