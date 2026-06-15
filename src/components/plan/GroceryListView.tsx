import type { Dispatch, SetStateAction } from 'react';
import type { GroceryItem, Staple } from '../../types';
import { ChecklistSection } from '../ui/ChecklistSection';

interface GroceryListViewProps {
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
  staples: Staple[];
  setStaples: Dispatch<SetStateAction<Staple[]>>;
}

export function GroceryListView({
  groceryList,
  setGroceryList,
  staples,
  setStaples,
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
      />
    </div>
  );
}
