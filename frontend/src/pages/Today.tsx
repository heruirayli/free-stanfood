import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useMemo, useState } from "react";
import { FaArrowRight } from "react-icons/fa";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import AgendaSection from "../components/AgendaSection";
import EventFilters from "../components/EventFilters";
import Page from "../components/Page";
import { AgendaSkeleton } from "../components/Skeleton";
import StatusMessage from "../components/StatusMessage";
import { CAMPUS_TIME_ZONE } from "../constants";
import { agendaIsEmpty, buildAgenda, showsTomorrow } from "../features/events/agenda";
import {
  clearFilters,
  getEvents,
  reset,
  selectEventState,
  selectFilters,
  selectHiddenLowConfidence,
  selectVisibleEvents,
  setFilters,
} from "../features/events/eventSlice";
import { hasActiveFilters, matchesWindow } from "../features/events/filterEvents";
import { sharedFilterSearch } from "../features/events/filterUrl";
import { useFilterUrlSync } from "../hooks/useFilterUrlSync";
import { useNow } from "../hooks/useNow";
import { linkClass, primaryButtonClass, secondaryButtonClass } from "../styles";
import { campusDateKey, hasEnded, startOfCampusDay } from "../utils/time";

const Today = () => {
  const dispatch = useAppDispatch();
  useFilterUrlSync("today");
  const { isLoading, isError, isSuccess, message } = useAppSelector(selectEventState);
  const filters = useAppSelector(selectFilters);
  const events = useAppSelector(selectVisibleEvents);
  const hiddenLowConfidence = useAppSelector(selectHiddenLowConfidence);
  const now = useNow();
  const [attempt, setAttempt] = useState(0);
  const campusDay = campusDateKey(now);
  const evening = showsTomorrow(now);

  // Load all of today (campus time), including what's already over, for Earlier
  // Today, and in the evening tomorrow too. Reloads when the evening starts and
  // when the campus day rolls over, so a tab left open overnight shows the new day.
  useEffect(() => {
    const start = new Date();
    const request = dispatch(
      getEvents({
        from: startOfCampusDay(start).toISOString(),
        to: startOfCampusDay(start, evening ? 2 : 1).toISOString(),
        minConfidence: 0,
      }),
    );
    return () => {
      request.abort();
      dispatch(reset());
    };
  }, [dispatch, attempt, campusDay, evening]);

  useEffect(() => {
    if (isError) toast.error(message);
  }, [isError, message]);

  const agenda = useMemo(
    () => buildAgenda(events.filter((event) => matchesWindow(event, filters.window, now)), now),
    [events, filters.window, now],
  );
  const hiddenCount = hiddenLowConfidence.filter(
    (event) => !hasEnded(event, now) && matchesWindow(event, filters.window, now),
  ).length;

  let content;
  if (isError) {
    content = (
      <StatusMessage tone="error" title="Couldn’t load events.">
        <p className="mb-4">{message}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={primaryButtonClass}>
          Try again
        </button>
      </StatusMessage>
    );
  } else if (isLoading || !isSuccess) {
    content = <AgendaSkeleton />;
  } else {
    let upcoming;
    if (agendaIsEmpty(agenda) && hasActiveFilters(filters, "today")) {
      upcoming = (
        <StatusMessage title="Nothing matches these filters right now.">
          <button type="button" onClick={() => dispatch(clearFilters())} className={`${secondaryButtonClass} mt-2`}>
            Clear filters
          </button>
        </StatusMessage>
      );
    } else if (agendaIsEmpty(agenda) && agenda.tomorrow.length > 0) {
      upcoming = <StatusMessage title="No more free food today. Here’s what’s on tomorrow." />;
    } else if (agendaIsEmpty(agenda)) {
      upcoming = (
        <StatusMessage title="No free food right now. Check back around lunch.">
          <Link to={{ pathname: "/week", search: sharedFilterSearch(filters) }} className={linkClass}>
            See what’s coming up this week
          </Link>
        </StatusMessage>
      );
    } else {
      upcoming = (
        <>
          <AgendaSection id="now" title="Happening Now" events={agenda.happeningNow} now={now} live />
          <AgendaSection id="later" title="Later Today" events={agenda.laterToday} now={now} />
          <AgendaSection id="tonight" title="Tonight" events={agenda.tonight} now={now} />
        </>
      );
    }
    // What's already over goes last, so what's still ahead stays on top.
    content = (
      <>
        <div className={agendaIsEmpty(agenda) ? "mb-7" : undefined}>{upcoming}</div>
        <AgendaSection id="tomorrow" title="Tomorrow" events={agenda.tomorrow} now={now} />
        <AgendaSection id="earlier" title="Earlier Today" events={agenda.earlierToday} now={now} />
      </>
    );
  }

  return (
    <Page title="Today" subtitle={formatInTimeZone(now, CAMPUS_TIME_ZONE, "EEEE, MMMM d")}>
      <EventFilters scope="today" />
      {content}
      {isSuccess && hiddenCount > 0 && (
        <p className="mt-4 text-center text-[0.9375rem] text-ink-muted">
          {hiddenCount} more {hiddenCount === 1 ? "listing has" : "listings have"} only a weak hint of food.{" "}
          <button
            type="button"
            onClick={() => dispatch(setFilters({ showLowConfidence: true }))}
            className="font-semibold text-ink underline underline-offset-[3px] hover:text-primary"
          >
            Show {hiddenCount === 1 ? "it" : "them"}
          </button>
        </p>
      )}
      {/* The rest of the week, like the header's Week tab (filters carried along). */}
      <div className="mt-8 flex justify-center">
        <Link to={{ pathname: "/week", search: sharedFilterSearch(filters) }} className={secondaryButtonClass}>
          See all events
          <FaArrowRight aria-hidden="true" className="text-[0.75rem]" />
        </Link>
      </div>
    </Page>
  );
};

export default Today;
