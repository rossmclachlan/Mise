import { ImageIcon } from 'lucide-react';

interface RecipeImageProps {
  src?: string;
  alt?: string;
  className?: string;
  iconSize?: number;
}

export function RecipeImage({ src, alt = '', className = '', iconSize = 28 }: RecipeImageProps) {
  if (src) {
    return <img src={src} alt={alt} className={`object-cover bg-surface-variant ${className}`} />;
  }

  return (
    <div className={`flex items-center justify-center bg-surface-variant text-ink-variant/60 ${className}`}>
      <ImageIcon size={iconSize} strokeWidth={1.5} />
    </div>
  );
}
