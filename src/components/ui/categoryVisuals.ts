import {
  Archive,
  Beef,
  Carrot,
  Croissant,
  CupSoda,
  Fish,
  Milk,
  Snowflake,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import type { GroceryCategory } from '../../types';

// Shared visual language for grocery categories, used by the grocery list,
// the Costco list, and the Supplies inventory so they read consistently.

export const CATEGORY_ICONS: Record<GroceryCategory, LucideIcon> = {
  produce: Carrot,
  dairy: Milk,
  meat: Beef,
  fish: Fish,
  bakery: Croissant,
  pantry: Archive,
  frozen: Snowflake,
  drinks: CupSoda,
  other: Tag,
};

export const CATEGORY_ACCENT: Record<GroceryCategory, string> = {
  produce: '#14532D',
  dairy: '#1E3A8A',
  meat: '#7F1D1D',
  fish: '#134E4A',
  bakery: '#78350F',
  pantry: '#4C1D95',
  frozen: '#0C4A6E',
  drinks: '#831843',
  other: '#334155',
};
