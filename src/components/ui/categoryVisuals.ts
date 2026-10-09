import type { GroceryCategory } from '../../types';

// Shared visual language for grocery categories, used by the grocery list,
// the Costco list, and the Supplies inventory so they read consistently.

export const CATEGORY_EMOJI: Record<GroceryCategory, string> = {
  produce: '🥕',
  dairy: '🧀',
  meat: '🥩',
  fish: '🐟',
  bakery: '🥐',
  pantry: '🫙',
  frozen: '🧊',
  drinks: '🧃',
  other: '🏷️',
};

export const CATEGORY_ACCENT: Record<GroceryCategory, string> = {
  produce: '#2D5A26',
  dairy: '#23497A',
  meat: '#8A2A1D',
  fish: '#1C5A52',
  bakery: '#7A4A0E',
  pantry: '#4A3696',
  frozen: '#1D5470',
  drinks: '#842A57',
  other: '#4A4A40',
};
