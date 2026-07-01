import type { GroceryCategory } from '../../types';
import { CATEGORY_ICONS } from './categoryVisuals';

export function CategoryIcon({ category, size }: { category: GroceryCategory; size: number }) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon size={size} />;
}
