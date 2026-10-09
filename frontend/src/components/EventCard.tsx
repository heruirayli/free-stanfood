import type { ReactNode } from "react";
import { FaMapMarkerAlt, FaRegClock, FaUsers } from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";
import type { FoodEvent } from "../types/event";
import type { BackgroundState } from "../utils/background";
import { cx } from "../utils/cx";
import { describeFood } from "../utils/food";
import { formatTimeRange, hasEnded, relativeTime, type RelativeTime } from "../utils/time";
import AudienceBadge from "./AudienceBadge";
import FoodBadge, { BAND_STYLES, foodBand } from "./FoodBadge";

interface EventCardProps {
  event: FoodEvent;
  now: Date;
}

const Line = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <p className="flex items-start gap-2">
    <span aria-hidden="true" className="mt-[0.2rem] shrink-0 text-[0.75rem]">
      {icon}
    </span>
    <span className="min-w-0">{children}</span>
  </p>
);

const Relative = ({ relative, ended }: { relative: RelativeTime; ended: boolean }) => {
  if (relative.endingSoon)
    return <span className="rounded-full bg-primary-soft px-2 py-px font-semibold text-primary">{relative.label}</span>;
  // "Ended" stays quiet; what's still to come is the news.
  return <span className={ended ? "text-ink-muted" : "font-semibold text-ink"}>{relative.label}</span>;
};

// One event on the Today page. The whole card opens its details, over the list.
const EventCard = ({ event, now }: EventCardProps) => {
  const location = useLocation();
  const titleId = `event-${event.id}-title`;
  const relative = relativeTime(event, now);
  const band = BAND_STYLES[foodBand(event.foodConfidence)];
  const state: BackgroundState = { background: location };

  return (
    <article
      aria-labelledby={titleId}
      className={cx(
        "relative overflow-hidden rounded-xl border bg-white py-3.5 pr-4 pl-5 transition-shadow hover:shadow-[0_6px_20px_-10px_rgba(46,45,41,0.35)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary",
        relative?.endingSoon ? "border-primary/35" : "border-line",
      )}
    >
      {/* The food band's color, as in the calendar. */}
      <span aria-hidden="true" className={cx("absolute inset-y-0 left-0 w-1", band.stripe)} />

      <p className="text-[1.0625rem] leading-snug font-bold text-ink">{describeFood(event.foodDetails)}</p>
      <h3 id={titleId} className="mt-0.5 leading-snug text-ink">
        <Link
          to={`/events/${event.id}`}
          state={state}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          {event.title}
        </Link>
      </h3>

      <div className="mt-2 space-y-1 text-[0.9375rem] text-ink-muted">
        <Line icon={<FaRegClock />}>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <time dateTime={event.startTime}>{formatTimeRange(event, now)}</time>
            {relative && (
              <>
                <span aria-hidden="true">·</span>
                <Relative relative={relative} ended={hasEnded(event, now)} />
              </>
            )}
          </span>
        </Line>
        {event.locationName && <Line icon={<FaMapMarkerAlt />}>{event.locationName}</Line>}
        {event.hostOrg && <Line icon={<FaUsers />}>{event.hostOrg}</Line>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <AudienceBadge audience={event.audience} />
        <FoodBadge confidence={event.foodConfidence} />
      </div>
    </article>
  );
};

export default EventCard;
