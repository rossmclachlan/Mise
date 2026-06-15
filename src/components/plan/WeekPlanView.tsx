import { useState, type Dispatch, type SetStateAction } from 'react';
import { BookOpen, Lightbulb, SkipForward, X } from 'lucide-react';
import {
  WEEK_DAYS,
  WEEK_DAY_LABELS,
  type MealPlanEntry,
  type Recipe,
  type WeekDay,
  type WeekPlan,
} from '../../types';
import { BottomSheet } from '../ui/BottomSheet';

interface WeekPlanViewProps {
  recipes: Recipe[];
  weekPlan: WeekPlan;
  setWeekPlan: Dispatch<SetStateAction<WeekPlan>>;
  onSelectRecipe: (id: string) => void;
}

const actionButtonClass =
  'flex flex-1 items-center justify-center gap-1.5 rounded-full border border-outline py-2 text-sm font-medium text-ink-variant active:bg-surface-variant';

export function WeekPlanView({ recipes, weekPlan, setWeekPlan, onSelectRecipe }: WeekPlanViewProps) {
  const [pickerDay, setPickerDay] = useState<WeekDay | null>(null);
  const [ideaDay, setIdeaDay] = useState<WeekDay | null>(null);
  const [ideaText, setIdeaText] = useState('');

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

  function chooseRecipe(recipeId: string) {
    if (pickerDay) setEntry(pickerDay, { type: 'recipe', recipeId });
    setPickerDay(null);
  }

  function openIdea(day: WeekDay) {
    const existing = weekPlan[day];
    setIdeaText(existing?.type === 'idea' ? existing.text : '');
    setIdeaDay(day);
  }

  function saveIdea() {
    if (!ideaDay) return;
    const text = ideaText.trim();
    setEntry(ideaDay, text ? { type: 'idea', text } : undefined);
    setIdeaDay(null);
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="mb-4 text-2xl font-bold">This Week</h1>

      <div className="space-y-3">
        {WEEK_DAYS.map((day) => {
          const entry = weekPlan[day];
          const recipe =
            entry?.type === 'recipe' ? recipes.find((r) => r.id === entry.recipeId) : undefined;

          return (
            <div key={day} className="card p-3">
              <div className="label-section mb-2">{WEEK_DAY_LABELS[day]}</div>

              {!entry && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPickerDay(day)} className={actionButtonClass}>
                    <BookOpen size={16} /> Recipe
                  </button>
                  <button type="button" onClick={() => openIdea(day)} className={actionButtonClass}>
                    <Lightbulb size={16} /> Idea
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntry(day, { type: 'skip' })}
                    className={actionButtonClass}
                  >
                    <SkipForward size={16} /> Skip
                  </button>
                </div>
              )}

              {entry?.type === 'recipe' && (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectRecipe(entry.recipeId)}
                    className="flex-1 text-left text-base font-medium"
                  >
                    {recipe ? recipe.title : 'Recipe not found'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntry(day, undefined)}
                    aria-label="Clear"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-variant active:bg-surface-variant"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {entry?.type === 'idea' && (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openIdea(day)}
                    className="flex-1 text-left text-base italic text-ink-variant"
                  >
                    {entry.text}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntry(day, undefined)}
                    aria-label="Clear"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-variant active:bg-surface-variant"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {entry?.type === 'skip' && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex-1 text-base text-ink-variant">Skipped</span>
                  <button
                    type="button"
                    onClick={() => setEntry(day, undefined)}
                    aria-label="Clear"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-variant active:bg-surface-variant"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomSheet isOpen={pickerDay !== null} onClose={() => setPickerDay(null)} title="Choose a Recipe">
        {recipes.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-variant">No recipes yet.</p>
        ) : (
          <ul className="divide-y divide-outline/60">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => chooseRecipe(recipe.id)}
                  className="w-full py-3 text-left text-base font-medium"
                >
                  {recipe.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>

      <BottomSheet isOpen={ideaDay !== null} onClose={() => setIdeaDay(null)} title="Meal Idea">
        <div className="flex flex-col gap-4 pb-4">
          <textarea
            className="input-field"
            rows={3}
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            placeholder="e.g. Something with the leftover chicken"
            autoFocus
          />
          <button type="button" onClick={saveIdea} className="btn-filled w-full">
            Save
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
