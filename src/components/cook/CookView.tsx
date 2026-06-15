import { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';
import type { Recipe } from '../../types';
import { scaleAmount } from '../../utils/scale';
import { extractDurationSeconds, formatSeconds } from '../../utils/timeParse';
import { useTimer } from '../../hooks/useTimer';
import { useWakeLock } from '../../hooks/useWakeLock';

interface CookViewProps {
  recipe: Recipe;
  onBack: () => void;
}

export function CookView({ recipe, onBack }: CookViewProps) {
  useWakeLock(true);

  const [servings, setServings] = useState(recipe.servings);
  const [stepIndex, setStepIndex] = useState(0);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);

  const ratio = servings / Math.max(1, recipe.servings);
  const totalSteps = recipe.steps.length;
  const currentStep = recipe.steps[stepIndex] ?? '';
  const duration = extractDurationSeconds(currentStep);

  const timer = useTimer(() => {
    window.alert("Time's up!");
  });

  function goPrev() {
    setStepIndex((i) => Math.max(0, i - 1));
    timer.reset();
  }

  function goNext() {
    setStepIndex((i) => Math.min(totalSteps - 1, i + 1));
    timer.reset();
  }

  const showCountdown = timer.secondsLeft > 0 || timer.isRunning;

  return (
    <div className="flex min-h-full flex-col px-4 pb-4 pt-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 self-start text-sm font-medium text-ink-variant"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <h1 className="text-xl font-bold">{recipe.title}</h1>

      <div className="card mt-3 flex items-center gap-3 p-3">
        <span className="font-medium">Servings</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
            aria-label="Decrease servings"
            className="btn-icon"
          >
            <Minus size={16} />
          </button>
          <span className="w-6 text-center font-semibold">{servings}</span>
          <button
            type="button"
            onClick={() => setServings((s) => s + 1)}
            aria-label="Increase servings"
            className="btn-icon"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="card mt-3">
        <button
          type="button"
          onClick={() => setIngredientsOpen((o) => !o)}
          className="flex w-full items-center justify-between p-3 font-semibold"
        >
          Ingredients
          <ChevronDown
            size={18}
            className={`transition-transform ${ingredientsOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {ingredientsOpen && (
          <ul className="divide-y divide-outline/60 border-t border-outline/60 px-3">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex justify-between gap-3 py-2 text-sm">
                <span>{ing.name}</span>
                <span className="shrink-0 text-ink-variant">
                  {[scaleAmount(ing.amount, ratio), ing.unit].filter(Boolean).join(' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalSteps === 0 ? (
        <p className="mt-16 text-center text-sm text-ink-variant">
          This recipe has no steps.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-1 flex-col items-center justify-center py-6 text-center">
            <span className="label-section text-accent">
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <p className="mt-3 text-2xl font-semibold leading-snug">{currentStep}</p>

            {duration !== null && (
              <div className="mt-6 flex flex-col items-center gap-3">
                {showCountdown ? (
                  <>
                    <span className="text-4xl font-bold tabular-nums">
                      {formatSeconds(timer.secondsLeft)}
                    </span>
                    <div className="flex gap-2">
                      {timer.isRunning ? (
                        <button type="button" onClick={timer.pause} className="btn-tonal">
                          <Pause size={16} /> Pause
                        </button>
                      ) : (
                        <button type="button" onClick={timer.resume} className="btn-tonal">
                          <Play size={16} /> Resume
                        </button>
                      )}
                      <button type="button" onClick={timer.reset} className="btn-tonal">
                        <RotateCcw size={16} /> Reset
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={() => timer.start(duration)} className="btn-filled">
                    Start Timer ({formatSeconds(duration)})
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={stepIndex === 0}
              className="btn-outlined flex-1"
            >
              <ChevronLeft size={20} /> Prev
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={stepIndex === totalSteps - 1}
              className="btn-filled flex-1"
            >
              Next <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
