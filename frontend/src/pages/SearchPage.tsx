import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import AgendaSection from "../components/AgendaSection";
import EventFilters from "../components/EventFilters";
import Page from "../components/Page";
import { AgendaSkeleton } from "../components/Skeleton";
import StatusMessage from "../components/StatusMessage";
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
import { hasActiveFilters } from "../features/events/filterEvents";
import { useFilterUrlSync } from "../hooks/useFilterUrlSync";
import { useNow } from "../hooks/useNow";
import { primaryButtonClass, secondaryButtonClass } from "../styles";
import type { FoodEvent } from "../types/event";
import { campusDateKey, dayKeyLabel } from "../utils/time";

// Typing pauses this long before the search goes out.
const SEARCH_DELAY_MS = 250;

interface Day {
  key: string;
  events: FoodEvent[];
}

// Results by campus day, soonest first. Events that started on an earlier day
// and are still on count as today's.
const byDay = (events: FoodEvent[], now: Date): Day[] => {
  const today = campusDateKey(now);
  const days = new Map<string, FoodEvent[]>();
  for (const event of events) {
    const start = campusDateKey(event.startTime);
    const key = start < today ? today : start;
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return [...days].map(([key, list]) => ({ key, events: list })).sort((a, b) => a.key.localeCompare(b.key));
};

// Every upcoming event, up to a year ahead, that matches the search, by day. The
// other pages search only what they show; this one asks the API (`q`).
const SearchPage = () => {
  const dispatch = useAppDispatch();
  useFilterUrlSync("search");
  const { isLoading, isError, isSuccess, message } = useAppSelector(selectEventState);
  const filters = useAppSelector(selectFilters);
  const events = useAppSelector(selectVisibleEvents);
  const hiddenLowConfidence = useAppSelector(selectHiddenLowConfidence);
  const now = useNow();
  const query = filters.query.trim();
  const [searched, setSearched] = useState(query);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearched(query), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // From now to a year ahead (the API's default window).
  useEffect(() => {
    if (!searched) return;
    const request = dispatch(getEvents({ q: searched, minConfidence: 0 }));
    return () => request.abort();
  }, [dispatch, searched, attempt]);

  useEffect(
    () => () => {
      dispatch(reset());
    },
    [dispatch],
  );

  useEffect(() => {
    if (isError) toast.error(message);
  }, [isError, message]);

  const days = useMemo(() => byDay(events, now), [events, now]);

  let content;
  if (!query) {
    content = (
      <StatusMessage title="Search every upcoming event.">
        <p>Try a food, a building, or a host. Results cover everything up to a year ahead.</p>
      </StatusMessage>
    );
  } else if (isError) {
    content = (
      <StatusMessage tone="error" title="Couldn’t search events.">
        <p className="mb-4">{message}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={primaryButtonClass}>
          Try again
        </button>
      </StatusMessage>
    );
  } else if (events.length === 0 && (isLoading || !isSuccess || searched !== query)) {
    content = <AgendaSkeleton />;
  } else if (events.length === 0) {
    content = (
      <StatusMessage title={`No upcoming events match “${query}”.`}>
        {hasActiveFilters(filters, "search") ? (
          <button
            type="button"
            onClick={() => dispatch(setFilters({ openOnly: false, foodTypes: [] }))}
            className={`${secondaryButtonClass} mt-2`}
          >
            Clear filters
          </button>
        ) : (
          <p>Try fewer or different words.</p>
        )}
      </StatusMessage>
    );
  } else {
    content = (
      <>
        <p role="status" className="mb-2 text-ink-muted">
          {events.length} upcoming {events.length === 1 ? "event" : "events"}
        </p>
        {days.map((day) => (
          <AgendaSection key={day.key} id={`day-${day.key}`} title={dayKeyLabel(day.key, now)} events={day.events} now={now} />
        ))}
      </>
    );
  }

  return (
    <Page
      title="Search"
      subtitle={query ? `Upcoming events matching “${query}”` : "Everything up to a year ahead"}
      documentTitle={query ? `Search: ${query}` : "Search"}
    >
      <EventFilters scope="search" />
      {content}
      {query && isSuccess && hiddenLowConfidence.length > 0 && (
        <p className="mt-4 text-center text-[0.9375rem] text-ink-muted">
          {hiddenLowConfidence.length} more {hiddenLowConfidence.length === 1 ? "listing has" : "listings have"} only a
          weak hint of food.{" "}
          <button
            type="button"
            onClick={() => dispatch(setFilters({ showLowConfidence: true }))}
            className="font-semibold text-ink underline underline-offset-[3px] hover:text-primary"
          >
            Show {hiddenLowConfidence.length === 1 ? "it" : "them"}
          </button>
        </p>
      )}
    </Page>
  );
};

export default SearchPage;
