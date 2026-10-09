import { useRef, useState } from 'react';
import type { Task } from '../types';
import { usePriorities } from '../state/PrioritiesContext';
import { orderBetween } from '../lib/ops';
import { TaskRow } from './bits';

/**
 * A section's tasks, reorderable by dragging a row's handle. Dropping a row
 * gives it an order halfway between its new neighbours, so only one document
 * changes. With `topThree`, the first three are marked as the week's top 3.
 */
export function ReorderList({
  tasks,
  now,
  onTick,
  onOpen,
  topThree,
  bare,
}: {
  tasks: Task[];
  now: string;
  onTick: (t: Task) => void;
  onOpen: (id: string) => void;
  topThree?: boolean;
  /** Rows only, for a list inside another card. */
  bare?: boolean;
}) {
  const { update } = usePriorities();
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<{ from: number; to: number; offset: number } | null>(null);
  const startY = useRef(0);

  function targetIndex(clientY: number): number {
    let idx = 0;
    rowRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (clientY > r.top + r.height / 2) idx = i;
    });
    return idx;
  }

  function onPointerDown(i: number, e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    setDrag({ from: i, to: i, offset: 0 });
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    setDrag({ ...drag, offset: e.clientY - startY.current, to: targetIndex(e.clientY) });
  }

  async function onPointerUp() {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    if (from === to) return;
    const rest = tasks.filter((_, i) => i !== from);
    await update(tasks[from], { order: orderBetween(rest[to - 1], rest[to]) }, 'reordered');
  }

  const marked = topThree && tasks.length > 3;

  return (
    <div className={bare ? 'divide-y divide-outline' : 'card divide-y divide-outline px-4'}>
      {tasks.map((t, i) => {
        const dragging = drag?.from === i;
        const showLine = drag && !dragging && drag.to === i && drag.from !== drag.to;
        return (
          <div
            key={t.id}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            className={`relative ${dragging ? 'z-10 rounded-xl bg-surface shadow-lg' : ''}`}
            style={dragging ? { transform: `translateY(${drag.offset}px)` } : undefined}
          >
            {marked && i === 0 && <p className="label-section pt-3 text-accent">Top 3 this week</p>}
            {marked && i === 3 && <p className="label-section pt-3">Then</p>}
            {showLine && (
              <div
                className={`absolute inset-x-0 h-0.5 bg-accent ${drag.to > drag.from ? 'bottom-0' : 'top-0'}`}
              />
            )}
            <TaskRow
              task={t}
              now={now}
              onTick={() => onTick(t)}
              onOpen={() => onOpen(t.id)}
              dragHandle={
                tasks.length > 1
                  ? {
                      onPointerDown: (e) => onPointerDown(i, e),
                      onPointerMove,
                      onPointerUp,
                      onPointerCancel: () => setDrag(null),
                    }
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
