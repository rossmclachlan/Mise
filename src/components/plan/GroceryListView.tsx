import type { Dispatch, SetStateAction } from 'react';
import type { GroceryItem, PantryItem, Staple } from '../../types';
import { ChecklistSection } from '../ui/ChecklistSection';
import { ItemListSection } from '../ui/ItemListSection';

interface GroceryListViewProps {
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
  staples: Staple[];
  setStaples: Dispatch<SetStateAction<Staple[]>>;
  pantry: PantryItem[];
  setPantry: Dispatch<SetStateAction<PantryItem[]>>;
}

export function GroceryListView({
  groceryList,
  setGroceryList,
  staples,
  setStaples,
  pantry,
  setPantry,
}: GroceryListViewProps) {
  function toggleItem(id: string) {
    setGroceryList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  }

  function removeItem(id: string) {
    setGroceryList((prev) => prev.filter((item) => item.id !== id));
  }

  function addItem(text: string) {
    setGroceryList((prev) => [...prev, { id: crypto.randomUUID(), text, checked: false }]);
  }

  function toggleStaple(id: string) {
    setStaples((prev) =>
      prev.map((staple) => (staple.id === id ? { ...staple, checked: !staple.checked } : staple)),
    );
  }

  function removeStaple(id: string) {
    setStaples((prev) => prev.filter((staple) => staple.id !== id));
  }

  function addStaple(text: string) {
    setStaples((prev) => [...prev, { id: crypto.randomUUID(), text, checked: false }]);
  }

  function removePantryItem(id: string) {
    setPantry((prev) => prev.filter((item) => item.id !== id));
  }

  function addPantryItem(text: string) {
    setPantry((prev) => [...prev, { id: crypto.randomUUID(), text }]);
  }

  return (
    <div className="space-y-6 px-4 pb-8 pt-4">
      <ChecklistSection
        title="Staples"
        items={staples}
        onToggle={toggleStaple}
        onRemove={removeStaple}
        onAdd={addStaple}
        addPlaceholder="Add a staple"
        emptyText="No staples yet."
      />
      <ChecklistSection
        title="Grocery List"
        items={groceryList}
        onToggle={toggleItem}
        onRemove={removeItem}
        onAdd={addItem}
        addPlaceholder="Add an item"
        emptyText="Your grocery list is empty."
        pantryItems={pantry}
      />
      <ItemListSection
        title="Pantry"
        items={pantry}
        onRemove={removePantryItem}
        onAdd={addPantryItem}
        addPlaceholder="Add a pantry item"
        emptyText="No pantry items yet."
      />
    </div>
  );
}
