import type { FoodEvent } from "../types/event";
import EventCard from "./EventCard";

interface AgendaSectionProps {
  id: string;
  title: string;
  events: FoodEvent[];
  now: Date;
  // Marks the section that's happening now with a live dot.
  live?: boolean;
}

// One of the Today page's sections. Its heading sticks below the header while its
// events scroll past, as in a calendar's agenda. Hidden when empty.
const AgendaSection = ({ id, title, events, now, live = false }: AgendaSectionProps) => {
  if (events.length === 0) return null;
  const headingId = `${id}-heading`;

  return (
    <section aria-labelledby={headingId} className="mb-7">
      <h2
        id={headingId}
        className="sticky top-[var(--header-height,0px)] z-10 -mx-4 mb-2 flex items-center gap-2 bg-white/95 px-4 py-2.5 font-bold text-ink backdrop-blur-sm"
      >
        {live && <span aria-hidden="true" className="size-2 rounded-full bg-primary" />}
        {title}
        <span className="text-sm font-normal text-ink-muted">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </h2>
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
};

export default AgendaSection;
