import type { ReactNode, Ref } from "react";
import {
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaRegCalendarPlus,
  FaRegClock,
  FaTicketAlt,
  FaUserCheck,
  FaUsers,
} from "react-icons/fa";
import { eventExportUrl, useCalendarExport } from "../features/events/calendarExport";
import { linkClass, primaryButtonClass } from "../styles";
import type { FoodEvent } from "../types/event";
import { describeFood } from "../utils/food";
import { formatEventTime, relativeTime } from "../utils/time";
import AudienceBadge from "./AudienceBadge";
import FoodBadge from "./FoodBadge";

interface EventDetailsProps {
  event: FoodEvent;
  now: Date;
  // h2 in a sheet over a page, h1 on the event's own page.
  headingLevel: "h1" | "h2";
  headingRef?: Ref<HTMLHeadingElement>;
}

const Detail = ({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) => (
  <div className="flex items-start gap-3">
    <dt className="sr-only">{label}</dt>
    <span aria-hidden="true" className="mt-[0.3rem] shrink-0 text-[0.8125rem] text-ink-muted">
      {icon}
    </span>
    <dd className="min-w-0">{children}</dd>
  </div>
);

// Everything about one event: the food, when and where, the full description,
// and links to add it to a calendar or open the original listing.
const EventDetails = ({ event, now, headingLevel: Heading, headingRef }: EventDetailsProps) => {
  const relative = relativeTime(event, now);
  // While a calendar page is open, its "Add to Your Calendar" choices.
  const exportState = useCalendarExport();
  const where = event.locationName ?? (event.isVirtual ? "Online" : "Not listed. Check the original listing.");

  return (
    <article aria-labelledby={`event-${event.id}-heading`}>
      <p className="text-2xl leading-tight font-bold text-ink">{describeFood(event.foodDetails)}</p>
      <Heading
        ref={headingRef}
        id={`event-${event.id}-heading`}
        tabIndex={-1}
        className="mt-1 text-lg leading-snug text-ink focus:outline-none"
      >
        {event.title}
      </Heading>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <AudienceBadge audience={event.audience} />
        <FoodBadge confidence={event.foodConfidence} />
      </div>

      <dl className="mt-5 space-y-2.5 rounded-xl bg-surface p-4 text-ink">
        <Detail label="When" icon={<FaRegClock />}>
          <time dateTime={event.startTime}>{formatEventTime(event, now)}</time>
          {relative && (
            <>
              {" · "}
              <span className={`whitespace-nowrap ${relative.endingSoon ? "font-semibold text-primary" : "text-ink-muted"}`}>
                {relative.label}
              </span>
            </>
          )}
        </Detail>
        <Detail label="Where" icon={<FaMapMarkerAlt />}>
          {where}
        </Detail>
        {event.hostOrg && (
          <Detail label="Host" icon={<FaUsers />}>
            {event.hostOrg}
          </Detail>
        )}
        {event.audienceNote && (
          <Detail label="Audience" icon={<FaUserCheck />}>
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
        <p className="mt-5 leading-relaxed whitespace-pre-line text-ink">{event.description}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a href={eventExportUrl(event)} download="free-stanfood-event.ics" className={primaryButtonClass}>
          <FaRegCalendarPlus aria-hidden="true" />
          Add to calendar
        </a>
        <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${linkClass} inline-flex items-center gap-1.5`}>
          View original event
          <FaExternalLinkAlt aria-hidden="true" className="text-[0.7rem]" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      {exportState.isExportable(event.id) && (
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-2.5 text-ink">
          <input
            type="checkbox"
            checked={exportState.isChosen(event.id)}
            onChange={() => exportState.toggle(event.id)}
            className="size-4 accent-ink"
          />
          Include in “Add to Your Calendar”
        </label>
      )}

      <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-muted">
        Food isn’t guaranteed. Check the original listing for the latest details, and respect who the event is for.
      </p>
    </article>
  );
};

export default EventDetails;
