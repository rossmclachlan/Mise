import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import type { CostcoItem, GroceryItem, Mode, Recipe, Staple, SupplyItem, WeekPlan } from './types';
import { useAuth } from './hooks/useAuth';
import { usePWAUpdate } from './hooks/usePWAUpdate';
import {
  migrateLegacySupplies,
  useCostcoList,
  useGroceryList,
  useLearnedCategories,
  useRecipes,
  useStaples,
  useSupplies,
  useWeekPlan,
} from './hooks/useFirestore';
import { categoriseItem } from './utils/categorise';
import { SEED_RECIPES, SEED_STAPLES, SEED_SUPPLIES } from './utils/seedData';
import { BottomNav } from './components/ui/BottomNav';
import { TopAppBar } from './components/ui/TopAppBar';
import { RecipeDetail } from './components/plan/RecipeDetail';
import { AddRecipeSheet } from './components/plan/AddRecipeSheet';
import { WeekPlanView } from './components/plan/WeekPlanView';
import { GroceryView } from './components/shop/ShopView';
import { CookList } from './components/cook/CookList';
import { CookView } from './components/cook/CookView';
import { LoginScreen } from './components/auth/LoginScreen';

// ─── Spinner ───────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-outline border-t-accent" />
    </div>
  );
}

// ─── Proxy setter factory ──────────────────────────────────────────────────
// Translates Dispatch<SetStateAction<T[]>> calls into individual Firestore
// add/update/remove operations, keeping all child component interfaces unchanged.

function makeProxySetter<T extends { id: string }>(
  currentItems: T[],
  ops: {
    add: (item: T) => void;
    update: (id: string, updates: Partial<T>) => void;
    remove: (id: string) => void;
  },
  onUpdate?: (prev: T, next: T) => void,
): Dispatch<SetStateAction<T[]>> {
  return (updater: SetStateAction<T[]>) => {
    const prev = currentItems;
    const next = typeof updater === 'function' ? updater(prev) : updater;

    const prevMap = new Map(prev.map((i) => [i.id, i]));
    const nextMap = new Map(next.map((i) => [i.id, i]));

    prev.forEach((item) => { if (!nextMap.has(item.id)) ops.remove(item.id); });
    next.forEach((item) => { if (!prevMap.has(item.id)) ops.add(item); });
    next.forEach((item) => {
      const old = prevMap.get(item.id);
      if (old && JSON.stringify(old) !== JSON.stringify(item)) {
        ops.update(item.id, item);
        onUpdate?.(old, item);
      }
    });
  };
}

// ─── Authenticated app ─────────────────────────────────────────────────────

function AuthenticatedApp({ user }: { user: User }) {
  const uid = user.uid;
  const [mode, setMode] = useState<Mode>('plan');
  const [cookDetailId, setCookDetailId] = useState<string | null>(null);
  const [cookRecipeId, setCookRecipeId] = useState<string | null>(null);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  // ── Firestore hooks ──
  const { recipes, loading: rl, addRecipe, updateRecipe, deleteRecipe } = useRecipes(uid);
  const {
    items: groceryItems,
    loading: gl,
    addItem: fsAddItem,
    updateItem: fsUpdateItem,
    removeItem: fsRemoveItem,
  } = useGroceryList(uid);
  const {
    staples,
    loading: sl,
    addStaple: fsAddStaple,
    updateStaple: fsUpdateStaple,
    removeStaple: fsRemoveStaple,
  } = useStaples(uid);
  const {
    supplies,
    loading: supl,
    addSupplyItem: fsAddSupplyItem,
    updateSupplyItem: fsUpdateSupplyItem,
    removeSupplyItem: fsRemoveSupplyItem,
  } = useSupplies(uid);
  const {
    costco,
    loading: cl,
    addCostcoItem: fsAddCostcoItem,
    updateCostcoItem: fsUpdateCostcoItem,
    removeCostcoItem: fsRemoveCostcoItem,
  } = useCostcoList(uid);
  const { weekPlan, loading: wl, saveWeekPlan } = useWeekPlan(uid);
  const { saveLearnedCategory } = useLearnedCategories(uid);

  const isLoading = rl || gl || sl || supl || cl || wl;

  // ── Migrate legacy supplies, then seed on first login (runs once) ──
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (isLoading || bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      const migrated = await migrateLegacySupplies(uid);

      if (recipes.length === 0) SEED_RECIPES.forEach((r) => addRecipe(r));
      if (staples.length === 0) SEED_STAPLES.forEach((s) => fsAddStaple(s));
      // Only seed supplies for a genuinely new account — never when we just
      // migrated an existing user's pantry/fridge/freezer into supplies.
      if (migrated === 0 && supplies.length === 0) {
        SEED_SUPPLIES.forEach((s) => fsAddSupplyItem(s));
      }
    })();
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Backfill missing categories on first load ──
  useEffect(() => {
    if (gl) return;
    groceryItems
      .filter((item) => !item.category)
      .forEach((item) => fsUpdateItem(item.id, { category: categoriseItem(item.text) }));
  }, [gl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cl) return;
    costco
      .filter((item) => !item.category)
      .forEach((item) => fsUpdateCostcoItem(item.id, { category: categoriseItem(item.text) }));
  }, [cl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Proxy setters — created fresh each render, close over current state ──
  const setRecipes = makeProxySetter<Recipe>(
    recipes,
    { add: addRecipe, update: updateRecipe, remove: deleteRecipe },
  );

  const setGroceryList = makeProxySetter<GroceryItem>(
    groceryItems,
    { add: fsAddItem, update: fsUpdateItem, remove: fsRemoveItem },
    (prev, next) => {
      if (prev.category !== next.category && next.category) {
        saveLearnedCategory(next.text, next.category);
      }
    },
  );

  const setStaples = makeProxySetter<Staple>(
    staples,
    { add: fsAddStaple, update: fsUpdateStaple, remove: fsRemoveStaple },
  );

  const setSupplies = makeProxySetter<SupplyItem>(
    supplies,
    { add: fsAddSupplyItem, update: fsUpdateSupplyItem, remove: fsRemoveSupplyItem },
    (prev, next) => {
      if (prev.category !== next.category && next.category) {
        saveLearnedCategory(next.text, next.category);
      }
    },
  );

  const setCostco = makeProxySetter<CostcoItem>(
    costco,
    { add: fsAddCostcoItem, update: fsUpdateCostcoItem, remove: fsRemoveCostcoItem },
  );

  const setWeekPlan = useCallback<Dispatch<SetStateAction<WeekPlan>>>(
    (updater) => {
      // weekPlan is stable enough here; we accept the closure captures the value at call time
      saveWeekPlan(typeof updater === 'function' ? updater(weekPlan) : updater);
    },
    [weekPlan, saveWeekPlan],
  );

  // ── Navigation ──
  function handleModeChange(next: Mode) {
    setMode(next);
    setCookDetailId(null);
    setCookRecipeId(null);
  }

  function handleSaveRecipe(recipe: Recipe) {
    setRecipes((prev) =>
      prev.some((r) => r.id === recipe.id)
        ? prev.map((r) => (r.id === recipe.id ? recipe : r))
        : [recipe, ...prev],
    );
  }

  function handleEditRecipe(recipe: Recipe) {
    setEditingRecipe(recipe);
    setShowAddRecipe(true);
  }

  function handleDeleteRecipe(id: string) {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setCookDetailId(null);
  }

  function handleAddToGroceryList(items: GroceryItem[]) {
    setGroceryList((prev) => [...prev, ...items]);
  }

  if (isLoading) return <Spinner />;

  const cookDetailRecipe = recipes.find((r) => r.id === cookDetailId) ?? null;
  const cookRecipe = recipes.find((r) => r.id === cookRecipeId) ?? null;

  let content;
  if (mode === 'plan') {
    content = (
      <WeekPlanView
        recipes={recipes}
        weekPlan={weekPlan}
        setWeekPlan={setWeekPlan}
        groceryList={groceryItems}
        setGroceryList={setGroceryList}
        supplies={supplies}
        onSelectRecipe={(id) => {
          setCookDetailId(id);
          setMode('cook');
        }}
      />
    );
  } else if (mode === 'grocery') {
    content = (
      <GroceryView
        groceryList={groceryItems}
        setGroceryList={setGroceryList}
        staples={staples}
        setStaples={setStaples}
        supplies={supplies}
        setSupplies={setSupplies}
        costco={costco}
        setCostco={setCostco}
      />
    );
  } else if (cookRecipe) {
    content = <CookView recipe={cookRecipe} onBack={() => setCookRecipeId(null)} />;
  } else if (cookDetailRecipe) {
    content = (
      <RecipeDetail
        recipe={cookDetailRecipe}
        onBack={() => setCookDetailId(null)}
        onDelete={() => handleDeleteRecipe(cookDetailRecipe.id)}
        onAddToGroceryList={handleAddToGroceryList}
        onCook={() => setCookRecipeId(cookDetailRecipe.id)}
        onEdit={() => handleEditRecipe(cookDetailRecipe)}
      />
    );
  } else {
    content = (
      <CookList
        recipes={recipes}
        onSelect={setCookDetailId}
        onAdd={() => setShowAddRecipe(true)}
      />
    );
  }

  return (
    <>
      <TopAppBar user={user} />
      <div className="relative flex-1 overflow-y-auto">{content}</div>
      <BottomNav active={mode} onChange={handleModeChange} />
      <AddRecipeSheet
        isOpen={showAddRecipe}
        onClose={() => {
          setShowAddRecipe(false);
          setEditingRecipe(null);
        }}
        onSave={handleSaveRecipe}
        editingRecipe={editingRecipe}
      />
    </>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────

function App() {
  const { user, loading: authLoading } = useAuth();
  const { needsRefresh, installUpdate } = usePWAUpdate();

  return (
    <div className="fixed inset-0 mx-auto flex max-w-[480px] flex-col bg-bg text-ink">
      {authLoading ? (
        <Spinner />
      ) : user ? (
        <AuthenticatedApp user={user} />
      ) : (
        <LoginScreen />
      )}
      {needsRefresh && (
        <div className="flex items-center justify-between bg-accent-container px-4 py-2.5">
          <span className="text-sm font-medium text-on-accent-container">
            Update available
          </span>
          <button
            type="button"
            onClick={installUpdate}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white"
          >
            Install
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
