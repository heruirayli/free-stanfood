import { motion } from "motion/react";
import type { ReactNode } from "react";
import { FaArrowRight, FaMapMarkerAlt, FaTicketAlt, FaUsers, FaUtensils } from "react-icons/fa";
import type { FoodEvent } from "../types/event";
import { cx } from "../utils/cx";
import { formatEventTime, isHappeningNow } from "../utils/time";
import AudienceBadge from "./AudienceBadge";
import FoodBadge from "./FoodBadge";

interface EventCardProps {
  event: FoodEvent;
  now: Date;
  headingLevel?: "h2" | "h3" | "h4";
}

interface DetailProps {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}

const Detail = ({ label, icon, children }: DetailProps) => (
  <div className="flex items-start gap-2.5">
    <dt className="sr-only">{label}</dt>
    <span aria-hidden="true" className="mt-[3px] shrink-0 text-xs text-stone-400">
      {icon}
    </span>
    <dd className="min-w-0">{children}</dd>
  </div>
);

const HappeningNow = () => (
  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white">
    <span aria-hidden="true" className="relative flex size-2">
      <motion.span
        className="absolute inset-0 rounded-full bg-white"
        animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
        transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
      />
      <span className="relative size-2 rounded-full bg-white" />
    </span>
    Happening now
  </span>
);

const EventCard = ({ event, now, headingLevel: Heading = "h3" }: EventCardProps) => {
  const happeningNow = isHappeningNow(event, now);
  const titleId = `event-${event.id}-title`;

  return (
    <motion.article
      aria-labelledby={titleId}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cx(
        "rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-shadow duration-300 hover:shadow-[0_12px_32px_-16px_rgba(28,25,23,0.25)]",
        happeningNow ? "border-emerald-600/40 ring-1 ring-emerald-600/40" : "border-stone-200/80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-stone-900 tabular-nums">{formatEventTime(event, now)}</p>
        {happeningNow && <HappeningNow />}
      </div>

      <Heading id={titleId} className="mt-1.5 text-[1.0625rem] leading-snug font-semibold tracking-tight text-stone-900">
        {event.title}
      </Heading>

      <dl className="mt-3 space-y-1.5 text-sm text-stone-600">
        {event.locationName && (
          <Detail label="Where" icon={<FaMapMarkerAlt />}>
            {event.locationName}
          </Detail>
        )}
        {event.foodDetails && (
          <Detail label="Food" icon={<FaUtensils />}>
            <span className="capitalize">{event.foodDetails}</span>
          </Detail>
        )}
        {event.hostOrg && (
          <Detail label="Host" icon={<FaUsers />}>
            {event.hostOrg}
          </Detail>
        )}
        {event.audienceNote && (
          <Detail label="Audience" icon={<FaUsers />}>
            Intended for: {event.audienceNote}
          </Detail>
        )}
        {event.cost && (
          <Detail label="Cost" icon={<FaTicketAlt />}>
            {event.cost}
          </Detail>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FoodBadge confidence={event.foodConfidence} />
        <AudienceBadge audience={event.audience} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-stone-100 pt-3">
        {event.description ? (
          <details className="group w-full text-sm text-stone-600 open:pb-1">
            <summary className="cursor-pointer list-none font-medium text-stone-700 select-none hover:text-stone-900 [&::-webkit-details-marker]:hidden">
              <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">
                ›
              </span>{" "}
              Details
            </summary>
            <p className="mt-2 leading-relaxed whitespace-pre-line">{event.description}</p>
          </details>
        ) : null}
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link inline-flex items-center gap-1.5 text-sm font-medium text-stone-900 underline decoration-stone-300 underline-offset-4 transition-colors hover:decoration-stone-900"
        >
          View original listing
          <FaArrowRight aria-hidden="true" className="text-[0.7rem] transition-transform group-hover/link:translate-x-0.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </motion.article>
  );
};

export default EventCard;
