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
        className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-ink py-2.5 pl-4 pr-2.5 text-sm font-semibold text-[#FFFBEF] shadow-xl"
      >
        <span aria-hidden className="shrink-0 text-lg leading-none">🎉</span>
        <span className="min-w-0 flex-1 truncate">{toast.title}</span>
        <button type="button" onClick={onUndo} className="shrink-0 px-1 font-bold text-[#FFFBEF]/80">
          Undo
        </button>
        <button type="button" onClick={onDetails} className="shrink-0 rounded-full bg-sun px-3 py-1.5 font-extrabold text-ink">
          Add details
        </button>
      </div>
    </div>
  );
}
