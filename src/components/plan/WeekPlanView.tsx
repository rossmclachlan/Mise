import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { BookOpen, Check, ChevronDown, GripVertical, Share2, X } from 'lucide-react';
import {
  WEEK_DAYS,
  WEEK_DAY_LABELS,
  type GroceryCategory,
  type GroceryItem,
  type MealPlanEntry,
  type Recipe,
  type SupplyItem,
  type WeekDay,
  type WeekPlan,
} from '../../types';
import { categoriseItem, learnCategory } from '../../utils/categorise';
import { isKeyIngredient, matchKeySupplies } from '../../utils/keyIngredients';
import { formatWeekPlanText } from '../../utils/shareWeekPlan';
import { ChecklistSection } from '../ui/ChecklistSection';
import { RecipeImage } from '../ui/RecipeImage';

interface WeekPlanViewProps {
  recipes: Recipe[];
  weekPlan: WeekPlan;
  setWeekPlan: Dispatch<SetStateAction<WeekPlan>>;
  groceryList: GroceryItem[];
  setGroceryList: Dispatch<SetStateAction<GroceryItem[]>>;
  supplies: SupplyItem[];
  onSelectRecipe: (id: string) => void;
}

export function WeekPlanView({
  recipes,
  weekPlan,
  setWeekPlan,
  groceryList,
  setGroceryList,
  supplies,
  onSelectRecipe,
}: WeekPlanViewProps) {
  const [expandedDay, setExpandedDay] = useState<WeekDay | null>(null);
  const [openDay, setOpenDay] = useState<WeekDay | null>(null);
  const [copied, setCopied] = useState(false);
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

  // Drag-to-reorder: dragging a day's meal onto another day swaps the two.
  const [drag, setDrag] = useState<{ day: WeekDay; offset: number; over: WeekDay | null } | null>(
    null,
  );
  const dragStartY = useRef(0);
  const cardRefs = useRef<Partial<Record<WeekDay, HTMLDivElement | null>>>({});

  function handleDragStart(day: WeekDay, e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    setOpenDay(null);
    setDrag({ day, offset: 0, over: null });
  }

  function handleDragMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    let over: WeekDay | null = null;
    for (const day of WEEK_DAYS) {
      if (day === drag.day) continue;
      const rect = cardRefs.current[day]?.getBoundingClientRect();
      if (rect && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        over = day;
        break;
      }
    }
    setDrag({ day: drag.day, offset: e.clientY - dragStartY.current, over });
  }

  function handleDragEnd() {
    if (!drag) return;
    if (drag.over && drag.over !== drag.day) swapDays(drag.day, drag.over);
    setDrag(null);
  }

  function swapDays(from: WeekDay, to: WeekDay) {
    setWeekPlan((prev) => {
      const next = { ...prev };
      const fromEntry = prev[from];
      const toEntry = prev[to];
      if (toEntry) next[from] = toEntry;
      else delete next[from];
      if (fromEntry) next[to] = fromEntry;
      else delete next[to];
      return next;
    });
    // Each day's grocery items (recipe ingredients and manual extras) follow
    // the meal to its new day.
    setGroceryList((prev) =>
      prev.map((item) =>
        item.from_day === from
          ? { ...item, from_day: to }
          : item.from_day === to
            ? { ...item, from_day: from }
            : item,
      ),
    );
    setDayInputs((prev) => ({ ...prev, [from]: prev[to] ?? '', [to]: prev[from] ?? '' }));
    setExpandedDay((prev) => (prev === from ? to : prev === to ? from : prev));
  }

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

  function editGroceryItemText(id: string, text: string) {
    setGroceryList((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
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

  async function handleShare() {
    const text = formatWeekPlanText(weekPlan, recipes);
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasPlan = WEEK_DAYS.some((day) => weekPlan[day]);

  // Key ingredients (proteins, carb bases, hero produce) lead both suggestion
  // rows; incidentals like salt or olive oil shouldn't drive meal ideas.
  const keySupplies = supplies.filter((s) => isKeyIngredient(s.text, s.category));
  const inspirationSupplies = [...supplies].sort(
    (a, b) =>
      Number(isKeyIngredient(b.text, b.category)) - Number(isKeyIngredient(a.text, a.category)) ||
      a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }),
  );

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">This Week</h1>
        <button
          type="button"
          onClick={handleShare}
          disabled={!hasPlan}
          className="btn-tonal flex items-center gap-1.5 px-4 py-2.5 text-sm disabled:opacity-40"
        >
          {copied ? <Check size={16} /> : <Share2 size={16} />}
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>

      <div className="space-y-3">
        {WEEK_DAYS.map((day) => {
          const entry = weekPlan[day];
          const recipe = entry?.recipeId ? recipes.find((r) => r.id === entry.recipeId) : undefined;
          const isExpanded = expandedDay === day;
          const isOpen = openDay === day;
          const dayItems = groceryList.filter((item) => item.from_day === day);
          const query = dayInputs[day]?.trim() ?? '';
          // Recipes that would use up key supplies float to the front
          // (sort is stable, so ties keep their original order).
          const suggestedRecipes = (
            query
              ? recipes.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
              : recipes
          )
            .map((r) => ({ recipe: r, supplyMatches: matchKeySupplies(r, keySupplies) }))
            .sort((a, b) => b.supplyMatches.length - a.supplyMatches.length);

          const isDragging = drag?.day === day;
          const isDropTarget = drag?.over === day;

          return (
            <div
              key={day}
              ref={(el) => {
                cardRefs.current[day] = el;
              }}
              className={`card overflow-hidden ${
                isDragging ? 'relative z-10 opacity-90 shadow-lg' : ''
              } ${isDropTarget ? 'ring-2 ring-accent' : ''}`}
              style={isDragging ? { transform: `translateY(${drag.offset}px)` } : undefined}
            >
              <div className="flex items-end gap-2 p-3">
                {entry && (
                  <button
                    type="button"
                    aria-label={`Reorder ${WEEK_DAY_LABELS[day]}`}
                    onPointerDown={(e) => handleDragStart(day, e)}
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={handleDragEnd}
                    className="btn-icon cursor-grab touch-none text-ink-variant active:cursor-grabbing"
                  >
                    <GripVertical size={18} />
                  </button>
                )}
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
                    <div className={supplies.length > 0 && !query ? 'mb-6' : ''}>
                      <p className="label-section mb-3">Recipes</p>
                      <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 py-2">
                        {suggestedRecipes.map(({ recipe: r, supplyMatches }) => (
                          <button
                            key={r.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectInspiration(day, r.title);
                            }}
                            className="card flex shrink-0 items-center gap-2.5 rounded-xl py-2 pl-2 pr-5 text-sm font-medium whitespace-nowrap active:shadow-none"
                          >
                            <RecipeImage
                              src={r.image}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-lg"
                              iconSize={16}
                            />
                            <span className="flex flex-col items-start">
                              {r.title}
                              {supplyMatches.length > 0 && (
                                <span
                                  className="text-[10px] font-semibold"
                                  style={{ color: '#14532D' }}
                                >
                                  ✓ {supplyMatches.map((s) => s.text).join(' · ')}
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-variant">No matching recipes.</p>
                  )}

                  {!query && supplies.length > 0 && (
                    <div>
                      <p className="label-section mb-3">From Supplies</p>
                      <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
                        {inspirationSupplies.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectInspiration(day, item.text);
                            }}
                            className={`chip-${item.category ?? 'other'} shrink-0 rounded-full px-5 py-2.5 text-xs font-semibold whitespace-nowrap`}
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
                    onEdit={editGroceryItemText}
                    onAdd={(text, category) => addManualDayItem(day, text, category)}
                    onCategoryChange={changeItemCategory}
                    showCategoryPreview
                    addPlaceholder="Add an item"
                    emptyText="No items yet for this meal."
                    supplyItems={supplies}
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
