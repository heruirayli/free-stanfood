import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import type { TimeGroup } from "../features/events/agenda";
import type { FoodEvent } from "../types/event";
import EventCard from "./EventCard";

interface AgendaSectionProps {
  id: string;
  title: string;
  // Shown after the title, e.g. the date.
  subtitle?: string;
  now: Date;
  // Either a flat list of events or events grouped under time headings.
  events?: FoodEvent[];
  groups?: TimeGroup[];
  icon?: ReactNode;
}

// Cards fade up in sequence on first render and glide into place when filters change.
const EventList = ({ events, now, headingLevel }: { events: FoodEvent[]; now: Date; headingLevel: "h3" | "h4" }) => (
  <ul className="space-y-3">
    <AnimatePresence initial={true} mode="popLayout">
      {events.map((event, index) => (
        <motion.li
          key={event.id}
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 6) * 0.04 }}
        >
          <EventCard event={event} now={now} headingLevel={headingLevel} />
        </motion.li>
      ))}
    </AnimatePresence>
  </ul>
);

const AgendaSection = ({ id, title, subtitle, now, events, groups, icon }: AgendaSectionProps) => {
  const count = (events?.length ?? 0) + (groups ?? []).reduce((sum, group) => sum + group.events.length, 0);
  if (count === 0) return null;
  const headingId = `${id}-heading`;

  return (
    <section aria-labelledby={headingId} className="mb-10">
      <h2 id={headingId} className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base font-semibold tracking-tight text-stone-900">
        {icon && (
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-white shadow-sm ring-1 ring-stone-200">
            {icon}
          </span>
        )}
        {title}
        {subtitle && <span className="font-normal text-stone-500">{subtitle}</span>}
      </h2>
      {events && <EventList events={events} now={now} headingLevel="h3" />}
      {groups?.map((group) => (
        <div key={group.label} className="mb-6">
          <h3 className="mb-3 flex items-center gap-3 text-xs font-medium tracking-wider text-stone-500 uppercase">
            {group.label}
            <span aria-hidden="true" className="h-px flex-1 bg-stone-200" />
          </h3>
          <EventList events={group.events} now={now} headingLevel="h4" />
        </div>
      ))}
    </section>
  );
};

export default AgendaSection;
