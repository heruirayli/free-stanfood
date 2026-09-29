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
      className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-xl bg-transparent p-0 backdrop:bg-black/50"
    >
      {event && (
        <div>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-700 shadow hover:bg-gray-100 hover:text-gray-900"
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>
          <EventCard event={event} now={now} headingLevel="h2" />
        </div>
      )}
    </dialog>
  );
};

export default EventDialog;
