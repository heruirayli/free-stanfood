import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../app/hooks";
import { LIKELY_THRESHOLD } from "../../constants";
import type { FoodEvent } from "../../types/event";
import { selectFilters } from "./eventSlice";
import eventService from "./eventService";

const CALENDAR_URL = "/api/events/calendar.ics";

// What the export list needs about each event. Kept instead of the full event, so
// a year of descriptions isn't held in memory twice (the calendar has its own copy).
export type ExportItem = Pick<FoodEvent, "id" | "title" | "startTime" | "allDay">;

const toExportItem = ({ id, title, startTime, allDay }: FoodEvent): ExportItem => ({ id, title, startTime, allDay });

const withQuery = (params: URLSearchParams): string => {
  const query = params.toString();
  return query ? `${CALENDAR_URL}?${query}` : CALENDAR_URL;
};

// The download URL for the chosen events. Everything is the default (no list at
// all); otherwise send whichever list is shorter: the chosen ids or the dropped ones.
export const exportUrl = (events: ExportItem[], deselected: ReadonlySet<string>, includeLow: boolean): string => {
  const params = new URLSearchParams();
  if (includeLow) params.set("minConfidence", "0");
  const dropped = events.filter((event) => deselected.has(event.id)).map((event) => event.id);
  if (dropped.length > 0) {
    const chosen = events.filter((event) => !deselected.has(event.id)).map((event) => event.id);
    if (chosen.length <= dropped.length) params.set("ids", chosen.join(","));
    else params.set("exclude", dropped.join(","));
  }
  return withQuery(params);
};

// A file with just this event. The window starts at the event, so it works for
// any date the calendar shows, including past events.
export const eventExportUrl = (event: FoodEvent): string => {
  const start = new Date(event.startTime);
  return withQuery(
    new URLSearchParams({
      ids: event.id,
      from: start.toISOString(),
      to: new Date(start.getTime() + 1).toISOString(),
      minConfidence: "0",
    }),
  );
};

export interface CalendarExportState {
  events: ExportItem[];
  status: "loading" | "ready" | "error";
  deselected: ReadonlySet<string>;
  url: string;
  isChosen: (id: string) => boolean;
  isExportable: (id: string) => boolean;
  toggle: (id: string) => void;
  setMany: (ids: string[], chosen: boolean) => void;
}

// The "Add to Your Calendar" choices, shared by the export section and the event
// dialog on the Calendar page. Loads every upcoming event with everything chosen, and
// reloads (choosing everything again) when the "Food possible" toggle changes.
export const useCalendarExport = (): CalendarExportState => {
  const { showLowConfidence } = useAppSelector(selectFilters);
  const [events, setEvents] = useState<ExportItem[]>([]);
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<CalendarExportState["status"]>("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    eventService
      .getEvents({ minConfidence: showLowConfidence ? 0 : LIKELY_THRESHOLD }, controller.signal)
      .then((loaded) => {
        setEvents(loaded.map(toExportItem));
        setDeselected(new Set());
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [showLowConfidence]);

  const exportableIds = useMemo(() => new Set(events.map((event) => event.id)), [events]);

  const setMany = useCallback(
    (ids: string[], chosen: boolean) =>
      setDeselected((current) => {
        const next = new Set(current);
        for (const id of ids) {
          if (chosen) next.delete(id);
          else next.add(id);
        }
        return next;
      }),
    [],
  );

  const toggle = useCallback(
    (id: string) =>
      setDeselected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  return {
    events,
    status,
    deselected,
    url: exportUrl(events, deselected, showLowConfidence),
    isChosen: (id) => exportableIds.has(id) && !deselected.has(id),
    isExportable: (id) => exportableIds.has(id),
    toggle,
    setMany,
  };
};
