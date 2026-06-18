import { useState, type Dispatch, type SetStateAction } from 'react';
import { BookOpen, ChevronDown, X } from 'lucide-react';
import {
  WEEK_DAYS,
  WEEK_DAY_LABELS,
  type GroceryCategory,
  type GroceryItem,
  type MealPlanEntry,
  type PantryItem,
  type Recipe,
  type WeekDay,
  type WeekPlan,
} from '../../types';
import { categoriseItem, learnCategory } from '../../utils/categorise';
import { ChecklistSection } from '../ui/ChecklistSection';

interface WeekPlanViewProps {
  recipes: Recipe[];
  weekPlan: WeekPlan;
  setWeekPlan: Dispatch<SetStateAction<WeekPlan>>;
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
  pantry: PantryItem[];
  onSelectRecipe: (id: string) => void;
}

export function WeekPlanView({
  recipes,
  weekPlan,
  setWeekPlan,
  groceryList,
  setGroceryList,
  pantry,
  onSelectRecipe,
}: WeekPlanViewProps) {
  const [expandedDay, setExpandedDay] = useState<WeekDay | null>(null);
  const [openDay, setOpenDay] = useState<WeekDay | null>(null);
  const [dayInputs, setDayInputs] = useState<Partial<Record<WeekDay, string>>>(() => {
    const initial: Partial<Record<WeekDay, string>> = {};
    for (const day of WEEK_DAYS) {
      const entry = weekPlan[day];
      if (entry?.recipeId) {
        initial[day] = recipes.find((r) => r.id === entry.recipeId)?.title ?? '';
      } else if (entry?.label) {
        initial[day] = entry.label;
      }
    }
    return initial;
  });

  function setEntry(day: WeekDay, entry: MealPlanEntry | undefined) {
    setWeekPlan((prev) => {
      const next = { ...prev };
      if (entry) {
        next[day] = entry;
      } else {
        delete next[day];
      }
      return next;
    });
  }

  function removeDayRecipeItems(day: WeekDay) {
    setGroceryList((prev) => prev.filter((item) => !(item.from_day === day && item.from_recipe_id)));
  }

  function addDayRecipeItems(day: WeekDay, recipe: Recipe) {
    const items: GroceryItem[] = recipe.ingredients
      .filter((ing) => ing.name.trim())
      .map((ing) => ({
        id: crypto.randomUUID(),
        text: [ing.amount, ing.unit, ing.name].filter(Boolean).join(' '),
        checked: false,
        from_recipe_id: recipe.id,
        from_day: day,
        category: categoriseItem(ing.name),
      }));
    setGroceryList((prev) => [...prev, ...items]);
  }

  function commitDayValue(day: WeekDay, rawValue: string) {
    setDayInputs((prev) => ({ ...prev, [day]: rawValue }));

    const trimmed = rawValue.trim();
    const prevEntry = weekPlan[day];

    if (!trimmed) {
      if (prevEntry?.recipeId) removeDayRecipeItems(day);
      if (prevEntry) setEntry(day, undefined);
      return;
    }

    const matchedRecipe = recipes.find((r) => r.title.toLowerCase() === trimmed.toLowerCase());

    if (matchedRecipe) {
      if (prevEntry?.recipeId !== matchedRecipe.id) {
        if (prevEntry?.recipeId) removeDayRecipeItems(day);
        addDayRecipeItems(day, matchedRecipe);
        setEntry(day, { recipeId: matchedRecipe.id });
      }
    } else {
      if (prevEntry?.recipeId) removeDayRecipeItems(day);
      if (prevEntry?.label !== trimmed) setEntry(day, { label: trimmed });
    }
  }

  function clearDay(day: WeekDay) {
    const entry = weekPlan[day];
    if (entry?.recipeId) removeDayRecipeItems(day);
    setEntry(day, undefined);
    setDayInputs((prev) => ({ ...prev, [day]: '' }));
    setOpenDay(null);
    setExpandedDay((prev) => (prev === day ? null : prev));
  }

  function selectInspiration(day: WeekDay, title: string) {
    setOpenDay(null);
    commitDayValue(day, title);
  }

  function toggleGroceryItem(id: string) {
    setGroceryList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  }

  function removeGroceryItem(id: string) {
    setGroceryList((prev) => prev.filter((item) => item.id !== id));
  }

  function changeItemCategory(id: string, category: GroceryCategory) {
    setGroceryList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        learnCategory(item.text, category);
        return { ...item, category };
      }),
    );
  }

  function addManualDayItem(day: WeekDay, text: string, category?: GroceryCategory) {
    setGroceryList((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text,
        checked: false,
        from_day: day,
        category: category ?? categoriseItem(text),
      },
    ]);
  }

  function toggleExpand(day: WeekDay) {
    setExpandedDay((prev) => (prev === day ? null : day));
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="mb-4 text-2xl font-bold">This Week</h1>

      <div className="space-y-3">
        {WEEK_DAYS.map((day) => {
          const entry = weekPlan[day];
          const recipe = entry?.recipeId ? recipes.find((r) => r.id === entry.recipeId) : undefined;
          const isExpanded = expandedDay === day;
          const isOpen = openDay === day;
          const dayItems = groceryList.filter((item) => item.from_day === day);
          const query = dayInputs[day]?.trim() ?? '';
          const suggestedRecipes = query
            ? recipes.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
            : recipes;

          return (
            <div key={day} className="card overflow-hidden">
              <div className="flex items-end gap-2 p-3">
                <div className="flex-1">
                  <div className="label-section mb-1.5">{WEEK_DAY_LABELS[day]}</div>
                  <input
                    type="text"
                    value={dayInputs[day] ?? ''}
                    onChange={(e) => commitDayValue(day, e.target.value)}
                    onFocus={() => setOpenDay(day)}
                    onBlur={() => setTimeout(() => setOpenDay((cur) => (cur === day ? null : cur)), 150)}
                    placeholder="Add a recipe or idea..."
                    className="input-field w-full"
                  />
                </div>
                {entry && (
                  <button
                    type="button"
                    onClick={() => clearDay(day)}
                    aria-label={`Clear ${WEEK_DAY_LABELS[day]}`}
                    className="btn-icon"
                  >
                    <X size={16} />
                  </button>
                )}
                {recipe && (
                  <button
                    type="button"
                    onClick={() => onSelectRecipe(recipe.id)}
                    aria-label={`View ${recipe.title}`}
                    className="btn-icon"
                  >
                    <BookOpen size={18} />
                  </button>
                )}
                {entry && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(day)}
                    aria-label={isExpanded ? `Collapse ${WEEK_DAY_LABELS[day]}` : `Expand ${WEEK_DAY_LABELS[day]}`}
                    aria-expanded={isExpanded}
                    className="btn-icon"
                  >
                    <ChevronDown size={18} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="border-t border-outline/60 px-5 pb-5 pt-5">
                  {suggestedRecipes.length > 0 ? (
                    <div className={pantry.length > 0 && !query ? 'mb-5' : ''}>
                      <p className="label-section mb-3">Recipes</p>
                      <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
                        {suggestedRecipes.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectInspiration(day, r.title);
                            }}
                            className="card shrink-0 rounded-xl px-5 py-3 text-sm font-medium whitespace-nowrap active:shadow-none"
                          >
                            {r.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-variant">No matching recipes.</p>
                  )}

                  {!query && pantry.length > 0 && (
                    <div>
                      <p className="label-section mb-3">From Pantry</p>
                      <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
                        {pantry.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectInspiration(day, item.text);
                            }}
                            className="chip-pantry shrink-0 rounded-full px-5 py-2.5 text-xs font-semibold whitespace-nowrap"
                          >
                            {item.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isExpanded && (
                <div className="border-t border-outline/60 px-3 pb-3 pt-3">
                  <ChecklistSection
                    items={dayItems}
                    onToggle={toggleGroceryItem}
                    onRemove={removeGroceryItem}
                    onAdd={(text, category) => addManualDayItem(day, text, category)}
                    onCategoryChange={changeItemCategory}
                    showCategoryPreview
                    addPlaceholder="Add an item"
                    emptyText="No items yet for this meal."
                    pantryItems={pantry}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
