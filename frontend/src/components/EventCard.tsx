import type { ReactNode } from "react";
import { FaClock, FaExternalLinkAlt, FaMapMarkerAlt, FaTicketAlt, FaUsers, FaUtensils } from "react-icons/fa";
import type { FoodEvent } from "../types/event";
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
  <div className="flex items-start gap-2">
    <dt className="sr-only">{label}</dt>
    <span aria-hidden="true" className="mt-0.5 shrink-0 text-gray-500">
      {icon}
    </span>
    <dd className="min-w-0">{children}</dd>
  </div>
);

const EventCard = ({ event, now, headingLevel: Heading = "h3" }: EventCardProps) => {
  const happeningNow = isHappeningNow(event, now);
  const titleId = `event-${event.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={`rounded-xl border bg-white p-4 shadow-sm ${happeningNow ? "border-emerald-600 ring-1 ring-emerald-600" : "border-gray-200"}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {happeningNow && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-2.5 py-0.5 text-xs font-semibold text-white">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Happening now
          </span>
        )}
        <FoodBadge confidence={event.foodConfidence} />
        <AudienceBadge audience={event.audience} />
      </div>

      <Heading id={titleId} className="text-lg font-semibold leading-snug text-gray-900">
        {event.title}
      </Heading>

      <dl className="mt-2 space-y-1 text-sm text-gray-700">
        <Detail label="When" icon={<FaClock />}>
          {formatEventTime(event, now)}
        </Detail>
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

      {event.description && (
        <details className="mt-3 text-sm text-gray-700">
          <summary className="cursor-pointer font-medium text-emerald-800 hover:underline">Details</summary>
          <p className="mt-2 whitespace-pre-line">{event.description}</p>
        </details>
      )}

      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
      >
        View original listing
        <FaExternalLinkAlt aria-hidden="true" className="text-xs" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </article>
  );
};

export default EventCard;
