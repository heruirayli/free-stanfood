import { Link, useLocation } from "react-router-dom";
import { useDisclosure } from "../hooks/useDisclosure";
import type { FoodEvent } from "../types/event";
import type { BackgroundState } from "../utils/background";
import { formatDayLabel, formatTime } from "../utils/time";

interface SeriesDatesProps {
  dates: FoodEvent[];
  now: Date;
}

// Every date of a folded series, behind a disclosure under its card. Each date
// opens that occurrence's details. The list renders only while open.
const SeriesDates = ({ dates, now }: SeriesDatesProps) => {
  const location = useLocation();
  const { isOpen, detailsProps } = useDisclosure();
  const state: BackgroundState = { background: location };
  // Times go with the dates only when they differ from date to date.
  const showTime = new Set(dates.map((date) => formatTime(date.startTime))).size > 1;

  return (
    <details {...detailsProps} className="group mt-1.5">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-[0.9375rem] font-semibold text-ink hover:text-primary [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">
          ›
        </span>
        <span className="underline underline-offset-[3px]">{isOpen ? "Hide dates" : `Show all ${dates.length} dates`}</span>
      </summary>
      {isOpen && (
        <ul className="mt-1 flex flex-wrap gap-2">
          {dates.map((date) => (
            <li key={date.id}>
              <Link
                to={`/events/${date.id}`}
                state={state}
                className="inline-flex h-9 items-center rounded-full border border-line bg-white px-3 text-[0.9375rem] text-ink transition-colors hover:bg-surface"
              >
                {formatDayLabel(date.startTime, now)}
                {showTime && !date.allDay && ` · ${formatTime(date.startTime)}`}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
};

export default SeriesDates;
