import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Take up most of the viewport, for longer forms like Add Recipe. */
  tall?: boolean;
}

/** A bottom sheet on phones; on wide screens, a centered dialog. */
export function BottomSheet({ isOpen, onClose, title, children, tall }: BottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex w-full max-w-[480px] flex-col self-end rounded-t-[28px] border-2 border-b-0 border-ink bg-surface shadow-xl md:mx-4 md:max-w-[560px] md:self-center md:rounded-[28px] md:border-b-2 ${
          tall ? 'h-[92vh] md:h-[85vh]' : 'max-h-[85vh]'
        }`}
      >
        <div className="flex shrink-0 flex-col items-center pt-2.5">
          {/* The grab handle is a little squiggle. */}
          <svg
            viewBox="0 0 44 8"
            aria-hidden
            className="h-2 w-11 fill-none stroke-ink-variant md:invisible"
          >
            <path d="M2 4 Q7.5 0 13 4 T24 4 T35 4 T42 4" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {title && (
            <div className="mt-2 flex w-full items-center justify-between px-4 pb-2">
              <h2 className="heading-section">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1 text-ink-variant hover:bg-surface-variant active:bg-surface-variant"
              >
                <X size={22} />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">{children}</div>
      </div>
    </div>
  );
}
