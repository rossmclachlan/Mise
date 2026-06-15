import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Take up most of the viewport, for longer forms like Add Recipe. */
  tall?: boolean;
}

export function BottomSheet({ isOpen, onClose, title, children, tall }: BottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        className={`relative flex w-full max-w-[480px] flex-col self-end rounded-t-[20px] bg-white shadow-xl ${
          tall ? 'h-[92vh]' : 'max-h-[85vh]'
        }`}
      >
        <div className="flex shrink-0 flex-col items-center pt-2.5">
          <div className="h-1.5 w-10 rounded-full bg-gray-300" />
          {title && (
            <div className="mt-2 flex w-full items-center justify-between px-4 pb-2">
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1 text-ink/50"
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
