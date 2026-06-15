import { useState } from 'react';
import type { GroceryItem, Mode, Recipe, Staple, WeekPlan } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { SEED_RECIPES, SEED_STAPLES } from './utils/seedData';
import { BottomNav } from './components/ui/BottomNav';
import { PillToggle } from './components/ui/PillToggle';
import { RecipeGrid } from './components/plan/RecipeGrid';
import { RecipeDetail } from './components/plan/RecipeDetail';
import { AddRecipeSheet } from './components/plan/AddRecipeSheet';
import { GroceryListView } from './components/plan/GroceryListView';
import { WeekPlanView } from './components/plan/WeekPlanView';
import { ShopView } from './components/shop/ShopView';
import { CookList } from './components/cook/CookList';
import { CookView } from './components/cook/CookView';

type PlanView = 'week' | 'recipes' | 'grocery';

function App() {
  const [mode, setMode] = useState<Mode>('plan');
  const [recipes, setRecipes] = useLocalStorage<Recipe[]>('recipes', SEED_RECIPES);
  const [groceryList, setGroceryList] = useLocalStorage<GroceryItem[]>('grocery_list', []);
  const [staples, setStaples] = useLocalStorage<Staple[]>('staples', SEED_STAPLES);
  const [weekPlan, setWeekPlan] = useLocalStorage<WeekPlan>('week_plan', {});

  const [planView, setPlanView] = useState<PlanView>('week');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [showAddRecipe, setShowAddRecipe] = useState(false);

  const [cookRecipeId, setCookRecipeId] = useState<string | null>(null);

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? null;
  const cookRecipe = recipes.find((r) => r.id === cookRecipeId) ?? null;

  function handleModeChange(next: Mode) {
    setMode(next);
    setSelectedRecipeId(null);
    setCookRecipeId(null);
  }

  function handleSaveRecipe(recipe: Recipe) {
    setRecipes((prev) => [recipe, ...prev]);
  }

  function handleDeleteRecipe(id: string) {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setSelectedRecipeId(null);
  }

  function handleAddToGroceryList(items: GroceryItem[]) {
    setGroceryList((prev) => [...prev, ...items]);
  }

  let content;
  if (mode === 'plan') {
    if (selectedRecipe) {
      content = (
        <RecipeDetail
          recipe={selectedRecipe}
          onBack={() => setSelectedRecipeId(null)}
          onDelete={() => handleDeleteRecipe(selectedRecipe.id)}
          onAddToGroceryList={handleAddToGroceryList}
        />
      );
    } else {
      content = (
        <div>
          <div className="flex justify-center px-4 pb-2 pt-4">
            <PillToggle
              options={[
                { label: 'This Week', value: 'week' },
                { label: 'Recipes', value: 'recipes' },
                { label: 'List', value: 'grocery' },
              ]}
              value={planView}
              onChange={(v) => setPlanView(v as PlanView)}
            />
          </div>
          {planView === 'week' ? (
            <WeekPlanView
              recipes={recipes}
              weekPlan={weekPlan}
              setWeekPlan={setWeekPlan}
              onSelectRecipe={setSelectedRecipeId}
            />
          ) : planView === 'recipes' ? (
            <RecipeGrid
              recipes={recipes}
              onSelect={setSelectedRecipeId}
              onAdd={() => setShowAddRecipe(true)}
            />
          ) : (
            <GroceryListView
              groceryList={groceryList}
              setGroceryList={setGroceryList}
              staples={staples}
              setStaples={setStaples}
            />
          )}
        </div>
      );
    }
  } else if (mode === 'shop') {
    content = (
      <ShopView
        groceryList={groceryList}
        setGroceryList={setGroceryList}
        staples={staples}
        setStaples={setStaples}
      />
    );
  } else {
    content = cookRecipe ? (
      <CookView recipe={cookRecipe} onBack={() => setCookRecipeId(null)} />
    ) : (
      <CookList recipes={recipes} onSelect={setCookRecipeId} />
    );
  }

  return (
    <div className="fixed inset-0 mx-auto flex max-w-[480px] flex-col bg-bg text-ink">
      <div className="relative flex-1 overflow-y-auto">{content}</div>
      <BottomNav active={mode} onChange={handleModeChange} />
      <AddRecipeSheet
        isOpen={showAddRecipe}
        onClose={() => setShowAddRecipe(false)}
        onSave={handleSaveRecipe}
      />
    </div>
  );
}

export default App;
