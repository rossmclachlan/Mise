import { ImageIcon } from 'lucide-react';

interface RecipeImageProps {
  className?: string;
  iconSize?: number;
}

export function RecipeImage({ className = '', iconSize = 28 }: RecipeImageProps) {
  return (
    <div className={`flex items-center justify-center bg-surface-variant text-ink-variant/60 ${className}`}>
      <ImageIcon size={iconSize} strokeWidth={1.5} />
    </div>
  );
}
