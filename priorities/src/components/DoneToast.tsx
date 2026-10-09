import { Check } from 'lucide-react';

export interface ToastState {
  taskId: string;
  title: string;
  /** The next occurrence a repeating task created; undo removes it. */
  nextId: string | null;
}

export function DoneToast({
  toast,
  onUndo,
  onDetails,
}: {
  toast: ToastState;
  onUndo: () => void;
  onDetails: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+10rem)] z-40 mx-auto flex max-w-[480px] justify-center px-4 md:bottom-8 md:left-56">
      <div
        role="status"
        className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-xl"
      >
        <Check size={18} className="shrink-0 text-good-container" />
        <span className="min-w-0 flex-1 truncate">{toast.title}</span>
        <button type="button" onClick={onDetails} className="shrink-0 font-semibold text-accent-container">
          Add details
        </button>
        <button type="button" onClick={onUndo} className="shrink-0 font-semibold text-white/80">
          Undo
        </button>
      </div>
    </div>
  );
}
