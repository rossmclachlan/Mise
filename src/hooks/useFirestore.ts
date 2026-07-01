import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { categoriseItem, learnCategory } from '../utils/categorise';
import type {
  CostcoItem,
  GroceryCategory,
  GroceryItem,
  Recipe,
  Staple,
  SupplyItem,
  WeekPlan,
} from '../types';

// ─── Generic collection hook ───────────────────────────────────────────────
// loading initialises to true only when uid is present so that the
// async onSnapshot callback is the only thing calling setState
// synchronously inside the effect body.

function useCollection<T extends { id: string }>(
  uid: string | null,
  collectionName: string,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(uid !== null);

  useEffect(() => {
    if (!uid) return;

    const colRef = collection(db, 'users', uid, collectionName);
    const q = query(colRef, orderBy('created_at', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T));
      setLoading(false);
    });
    return () => {
      unsub();
      setItems([]);
    };
  }, [uid, collectionName]);

  function itemDoc(id: string) {
    return doc(db, 'users', uid!, collectionName, id);
  }

  return { items, loading, itemDoc };
}

// ─── Recipes ───────────────────────────────────────────────────────────────

export function useRecipes(uid: string | null) {
  const { items: recipes, loading, itemDoc } = useCollection<Recipe>(uid, 'recipes');

  function addRecipe(recipe: Recipe) {
    setDoc(itemDoc(recipe.id), { ...recipe, created_at: recipe.created_at });
  }

  function updateRecipe(id: string, updates: Partial<Recipe>) {
    updateDoc(itemDoc(id), updates as Record<string, unknown>);
  }

  function deleteRecipe(id: string) {
    deleteDoc(itemDoc(id));
  }

  return { recipes, loading, addRecipe, updateRecipe, deleteRecipe };
}

// ─── Grocery list ──────────────────────────────────────────────────────────

export function useGroceryList(uid: string | null) {
  const { items, loading, itemDoc } = useCollection<GroceryItem>(uid, 'grocery_list');

  function addItem(item: GroceryItem) {
    setDoc(itemDoc(item.id), { ...item, created_at: item.id }); // id doubles as stable sort key
  }

  function updateItem(id: string, updates: Partial<GroceryItem>) {
    updateDoc(itemDoc(id), updates as Record<string, unknown>);
  }

  function removeItem(id: string) {
    deleteDoc(itemDoc(id));
  }

  function clearChecked() {
    items.filter((i) => i.checked).forEach((i) => deleteDoc(itemDoc(i.id)));
  }

  return { items, loading, addItem, updateItem, removeItem, clearChecked };
}

// ─── Staples ───────────────────────────────────────────────────────────────

export function useStaples(uid: string | null) {
  const { items: staples, loading, itemDoc } = useCollection<Staple>(uid, 'staples');

  function addStaple(staple: Staple) {
    setDoc(itemDoc(staple.id), { ...staple, created_at: staple.id });
  }

  function updateStaple(id: string, updates: Partial<Staple>) {
    updateDoc(itemDoc(id), updates as Record<string, unknown>);
  }

  function removeStaple(id: string) {
    deleteDoc(itemDoc(id));
  }

  return { staples, loading, addStaple, updateStaple, removeStaple };
}

// ─── Costco list ────────────────────────────────────────────────────────────

export function useCostcoList(uid: string | null) {
  const { items: costco, loading, itemDoc } = useCollection<CostcoItem>(uid, 'costco');

  function addCostcoItem(item: CostcoItem) {
    setDoc(itemDoc(item.id), { ...item, created_at: item.id });
  }

  function updateCostcoItem(id: string, updates: Partial<CostcoItem>) {
    updateDoc(itemDoc(id), updates as Record<string, unknown>);
  }

  function removeCostcoItem(id: string) {
    deleteDoc(itemDoc(id));
  }

  return { costco, loading, addCostcoItem, updateCostcoItem, removeCostcoItem };
}

// ─── Supplies (at-home inventory) ────────────────────────────────────────────

export function useSupplies(uid: string | null) {
  const { items: supplies, loading, itemDoc } = useCollection<SupplyItem>(uid, 'supplies');

  function addSupplyItem(item: SupplyItem) {
    setDoc(itemDoc(item.id), { ...item, created_at: item.id });
  }

  function updateSupplyItem(id: string, updates: Partial<SupplyItem>) {
    updateDoc(itemDoc(id), updates as Record<string, unknown>);
  }

  function removeSupplyItem(id: string) {
    deleteDoc(itemDoc(id));
  }

  return { supplies, loading, addSupplyItem, updateSupplyItem, removeSupplyItem };
}

// One-time migration: fold the legacy pantry/fridge/freezer collections into
// the unified `supplies` collection, auto-categorising each item by its text.
// Atomic (single batch) and idempotent — reuses each item's id, so a re-run
// simply re-copies before deleting the legacy docs. Returns how many items
// were migrated (0 once the legacy collections are empty).
export async function migrateLegacySupplies(uid: string): Promise<number> {
  const legacyCollections = ['pantry', 'fridge', 'freezer'];
  const batch = writeBatch(db);
  let migrated = 0;

  for (const name of legacyCollections) {
    const snap = await getDocs(collection(db, 'users', uid, name));
    snap.forEach((legacyDoc) => {
      const data = legacyDoc.data() as { text?: string; created_at?: string };
      const text = (data.text ?? '').toString();
      batch.set(doc(db, 'users', uid, 'supplies', legacyDoc.id), {
        text,
        category: categoriseItem(text),
        created_at: data.created_at ?? legacyDoc.id,
      });
      batch.delete(legacyDoc.ref);
      migrated += 1;
    });
  }

  if (migrated > 0) await batch.commit();
  return migrated;
}

// ─── Week plan (single document) ───────────────────────────────────────────

export function useWeekPlan(uid: string | null) {
  const [weekPlan, setWeekPlan] = useState<WeekPlan>({});
  const [loading, setLoading] = useState(uid !== null);

  useEffect(() => {
    if (!uid) return;
    const docRef = doc(db, 'users', uid, 'app', 'week_plan');
    const unsub = onSnapshot(docRef, (snap) => {
      setWeekPlan(snap.exists() ? (snap.data() as WeekPlan) : {});
      setLoading(false);
    });
    return () => {
      unsub();
      setWeekPlan({});
    };
  }, [uid]);

  function saveWeekPlan(plan: WeekPlan) {
    if (!uid) return;
    setDoc(doc(db, 'users', uid, 'app', 'week_plan'), plan);
  }

  return { weekPlan, loading, saveWeekPlan };
}

// ─── Learned categories (single document) ──────────────────────────────────

export function useLearnedCategories(uid: string | null) {
  const [learned, setLearned] = useState<Record<string, GroceryCategory>>({});

  useEffect(() => {
    if (!uid) return;
    const docRef = doc(db, 'users', uid, 'app', 'learned_categories');
    const unsub = onSnapshot(docRef, (snap) => {
      const data = snap.exists() ? (snap.data() as Record<string, GroceryCategory>) : {};
      setLearned(data);
      try {
        localStorage.setItem('learned_categories', JSON.stringify(data));
      } catch {
        // ignore storage errors
      }
    });
    return unsub;
  }, [uid]);

  function saveLearnedCategory(text: string, category: GroceryCategory) {
    if (!uid) return;
    const key = text.toLowerCase().trim();
    learnCategory(text, category); // update localStorage immediately
    setDoc(
      doc(db, 'users', uid, 'app', 'learned_categories'),
      { [key]: category },
      { merge: true },
    );
  }

  return { learned, saveLearnedCategory };
}
