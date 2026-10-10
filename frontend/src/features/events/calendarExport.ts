import { createSelector } from "@reduxjs/toolkit";
import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { CALENDAR_FEED_PATH, REMINDER_MINUTES } from "../../constants";
import type { FoodEvent } from "../../types/event";
import { selectFilters } from "./eventSlice";
import {
  clearExport,
  loadExport,
  selectCalendarExport,
  setExportEvents,
  toggleExportEvent,
  type ExportItem,
} from "./exportSlice";

const withQuery = (params: URLSearchParams): string => {
  const query = params.toString();
  return query ? `${CALENDAR_FEED_PATH}?${query}` : CALENDAR_FEED_PATH;
};

// The download URL for the chosen events, with reminders. Everything is the
// default (no list at all); otherwise send whichever list is shorter: the chosen
// ids or the dropped ones.
export const exportUrl = (
  events: ExportItem[],
  deselected: Readonly<Record<string, true>>,
  includeLow: boolean,
): string => {
  const params = new URLSearchParams();
  if (includeLow) params.set("minConfidence", "0");
  params.set("alarm", String(REMINDER_MINUTES));
  const dropped = events.filter((event) => event.id in deselected).map((event) => event.id);
  if (dropped.length > 0) {
    const chosen = events.filter((event) => !(event.id in deselected)).map((event) => event.id);
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
      alarm: String(REMINDER_MINUTES),
    }),
  );
};

const selectExportUrl = createSelector([selectCalendarExport], ({ items, deselected, includeLow }) =>
  exportUrl(items, deselected, includeLow),
);

const selectExportIds = createSelector([selectCalendarExport], ({ items }) => new Set(items.map((item) => item.id)));

export interface CalendarExportState {
  events: ExportItem[];
  status: "idle" | "loading" | "ready" | "error";
  deselected: Readonly<Record<string, true>>;
  url: string;
  isChosen: (id: string) => boolean;
  // In the list, so it can be added or dropped (only while a calendar page is open).
  isExportable: (id: string) => boolean;
  toggle: (id: string) => void;
  setMany: (ids: string[], chosen: boolean) => void;
}

// The "Add to Your Calendar" choices, for the export section and an event's details.
export const useCalendarExport = (): CalendarExportState => {
  const dispatch = useAppDispatch();
  const { items, status, deselected } = useAppSelector(selectCalendarExport);
  const url = useAppSelector(selectExportUrl);
  const ids = useAppSelector(selectExportIds);
  const toggle = useCallback((id: string) => dispatch(toggleExportEvent(id)), [dispatch]);
  const setMany = useCallback(
    (list: string[], chosen: boolean) => dispatch(setExportEvents({ ids: list, chosen })),
    [dispatch],
  );

  return useMemo(
    () => ({
      events: items,
      status,
      deselected,
      url,
      isChosen: (id: string) => ids.has(id) && !(id in deselected),
      isExportable: (id: string) => ids.has(id),
      toggle,
      setMany,
    }),
    [items, status, deselected, url, ids, toggle, setMany],
  );
};

// Loads the choices while a calendar page is open (again, with everything chosen,
// when the "Food possible" toggle changes) and frees them when it closes.
export const useLoadCalendarExport = (): void => {
  const dispatch = useAppDispatch();
  const { showLowConfidence } = useAppSelector(selectFilters);

  useEffect(() => {
    const request = dispatch(loadExport({ includeLow: showLowConfidence }));
    return () => request.abort();
  }, [dispatch, showLowConfidence]);

  useEffect(
    () => () => {
      dispatch(clearExport());
    },
    [dispatch],
  );
};
