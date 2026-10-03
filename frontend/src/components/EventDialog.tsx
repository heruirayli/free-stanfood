import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { FaTimes } from "react-icons/fa";
import type { FoodEvent } from "../types/event";
import EventCard from "./EventCard";

interface EventDialogProps {
  event: FoodEvent | null;
  now: Date;
  onClose: () => void;
}

// Modal event details for the calendar. The native <dialog> handles focus
// trapping and closes on Escape.
const EventDialog = ({ event, now, onClose }: EventDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (event && !dialog.open) dialog.showModal();
    if (!event && dialog.open) dialog.close();
  }, [event]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      aria-label={event?.title ?? "Event details"}
      // Scrolls itself: a modal dialog is fixed in place, so long details would
      // otherwise run off-screen with the source link. The padding keeps the close
      // button's ring and focus outline inside the scroll area.
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100%-2rem))] overflow-y-auto overscroll-contain bg-transparent p-1 backdrop:bg-stone-900/40 backdrop:backdrop-blur-sm"
    >
      {event && (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        >
          {/* Sticky, so Close stays in reach while scrolling a long description. */}
          <div className="sticky top-0 z-10 mb-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-11 items-center justify-center rounded-full bg-white text-stone-700 shadow-sm ring-1 ring-stone-200 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>
          <EventCard event={event} now={now} headingLevel="h2" />
        </motion.div>
      )}
    </dialog>
  );
};

export default EventDialog;
