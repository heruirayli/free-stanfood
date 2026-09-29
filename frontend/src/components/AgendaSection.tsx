import type { ReactNode } from "react";
import type { TimeGroup } from "../features/events/agenda";
import type { FoodEvent } from "../types/event";
import EventCard from "./EventCard";

interface AgendaSectionProps {
  id: string;
  title: string;
  now: Date;
  // Either a flat list of events or events grouped under time headings.
  events?: FoodEvent[];
  groups?: TimeGroup[];
  icon?: ReactNode;
}

const EventList = ({ events, now, headingLevel }: { events: FoodEvent[]; now: Date; headingLevel: "h3" | "h4" }) => (
  <ul className="space-y-3">
    {events.map((event) => (
      <li key={event.id}>
        <EventCard event={event} now={now} headingLevel={headingLevel} />
      </li>
    ))}
  </ul>
);

const AgendaSection = ({ id, title, now, events, groups, icon }: AgendaSectionProps) => {
  if ((events?.length ?? 0) === 0 && (groups?.length ?? 0) === 0) return null;
  const headingId = `${id}-heading`;

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h2 id={headingId} className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
        {icon}
        {title}
      </h2>
      {events && <EventList events={events} now={now} headingLevel="h3" />}
      {groups?.map((group) => (
        <div key={group.label} className="mb-4">
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-600 uppercase">{group.label}</h3>
          <EventList events={group.events} now={now} headingLevel="h4" />
        </div>
      ))}
    </section>
  );
};

export default AgendaSection;
