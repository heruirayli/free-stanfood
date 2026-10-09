import axios from "axios";
import { parseISO } from "date-fns";
import { ASSUMED_DURATION_MS } from "../../constants";
import type { EventQuery, FoodEvent } from "../../types/event";
import { parseEvents } from "./parseEvents";

// Events on a static host (GitHub Pages), where there's no API to ask: the build
// writes every published event to data/events.json next to the site. It's loaded
// once, then filtered here the way GET /api/events filters on the server
// (backend/utils/eventFilter.ts; keep the two in sync).

const DATA_URL = `${import.meta.env.BASE_URL}data/events.json`;
const DEFAULT_WINDOW_DAYS = 366;
const MAX_RESULTS = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

let loaded: Promise<FoodEvent[]> | null = null;

// Shared by every caller, so it isn't tied to one page's abort signal. A failed
// load is forgotten, so "Try again" fetches it again.
export const loadStaticEvents = (): Promise<FoodEvent[]> => {
  loaded ??= axios
    .get<unknown>(DATA_URL)
    .then((response) => parseEvents(response.data))
    .catch((error: unknown) => {
      loaded = null;
      throw error;
    });
  return loaded;
};

const effectiveEnd = (event: FoodEvent): number =>
  parseISO(event.endTime ?? event.startTime).getTime() + (event.endTime ? 0 : ASSUMED_DURATION_MS);

const matchesText = (event: FoodEvent, text: string): boolean =>
  [event.title, event.description, event.hostOrg, event.locationName, event.foodDetails].some((field) =>
    field?.toLowerCase().includes(text),
  );

// Events overlapping [from, to), matching the optional filters, soonest first.
export const selectStaticEvents = (events: FoodEvent[], query: EventQuery, now: Date): FoodEvent[] => {
  const from = query.from ? parseISO(query.from).getTime() : now.getTime();
  const to = query.to ? parseISO(query.to).getTime() : from + DEFAULT_WINDOW_DAYS * DAY_MS;
  const text = query.q?.toLowerCase();
  return events
    .filter(
      (event) =>
        event.audience !== "restricted" &&
        (query.audience === undefined || event.audience === query.audience) &&
        parseISO(event.startTime).getTime() < to &&
        effectiveEnd(event) >= from &&
        (query.minConfidence === undefined || event.foodConfidence >= query.minConfidence) &&
        (!text || matchesText(event, text)),
    )
    .sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime())
    .slice(0, MAX_RESULTS);
};
