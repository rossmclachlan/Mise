import type { GroceryCategory } from '../../types';
import { CATEGORY_EMOJI } from './categoryVisuals';

export function CategoryIcon({ category, size }: { category: GroceryCategory; size: number }) {
  return (
    <span aria-hidden className="leading-none" style={{ fontSize: size }}>
      {CATEGORY_EMOJI[category]}
    </span>
  );
}
