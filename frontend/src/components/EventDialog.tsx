import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { FaCalendarPlus, FaTimes } from "react-icons/fa";
import { eventExportUrl, type CalendarExportState } from "../features/events/calendarExport";
import type { FoodEvent } from "../types/event";
import EventCard from "./EventCard";

interface EventDialogProps {
  event: FoodEvent | null;
  now: Date;
  onClose: () => void;
  // The page's "Add to Your Calendar" choices, so the dialog can add or drop this event.
  exportState: CalendarExportState;
}

// The calendar actions for one event: download just this event, or (when it's in
// the next 8 weeks) include it in the "Add to Your Calendar" download below the calendar.
const AddToCalendar = ({ event, exportState }: { event: FoodEvent; exportState: CalendarExportState }) => (
  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200">
    <a
      href={eventExportUrl(event)}
      download="free-stanfood-event.ics"
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-medium text-white transition-colors hover:bg-stone-700"
    >
      <FaCalendarPlus aria-hidden="true" />
      Download this event (.ics)
    </a>
    {exportState.isExportable(event.id) && (
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-stone-800">
        <input
          type="checkbox"
          checked={exportState.isChosen(event.id)}
          onChange={() => exportState.toggle(event.id)}
          className="size-4 accent-stone-900"
        />
        Include in “Add to Your Calendar”
      </label>
    )}
  </div>
);

// Modal event details for the calendar. The native <dialog> handles focus
// trapping and closes on Escape.
const EventDialog = ({ event, now, onClose, exportState }: EventDialogProps) => {
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
          <AddToCalendar event={event} exportState={exportState} />
        </motion.div>
      )}
    </dialog>
  );
};

export default EventDialog;
