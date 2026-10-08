import { useLayoutEffect, useRef, type ReactNode } from "react";
import { FaTimes } from "react-icons/fa";

interface SheetProps {
  onClose: () => void;
  // An accessible name: a label, or the id of a heading inside.
  label?: string;
  labelledBy?: string;
  children: ReactNode;
}

// A modal panel: a sheet rising from the bottom on phones, a centered card from
// sm up. Open while mounted. The native <dialog> traps focus and closes on Escape,
// and closing it hands focus back to whatever opened it.
const Sheet = ({ onClose, label, labelledBy, children }: SheetProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const unmounting = useRef(false);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    unmounting.current = false;
    dialog.showModal();
    return () => {
      unmounting.current = true;
      dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      aria-labelledby={labelledBy}
      // Escape closed it. Ignore the "close" from unmounting, and a late one
      // from before a reopen (StrictMode remounts effects in development).
      onClose={() => {
        if (!unmounting.current && !ref.current?.open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // backdrop click
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto overscroll-contain rounded-t-2xl border-0 bg-white p-0 text-ink shadow-[0_-8px_40px_-12px_rgba(46,45,41,0.35)] backdrop:bg-ink/45 open:animate-sheet-in sm:m-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[min(36rem,calc(100%-2rem))] sm:rounded-2xl"
    >
      {/* Sticky, so Close stays in reach while scrolling a long description. */}
      <div className="sticky top-0 z-10 flex justify-end bg-white/95 px-3 pt-3 backdrop-blur-sm">
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-11 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <FaTimes aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-7 sm:pb-7">{children}</div>
    </dialog>
  );
};

export default Sheet;
