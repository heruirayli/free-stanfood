import { addDays } from "date-fns";
import { PUBLIC_AUDIENCES, type Audience, type Event, type EventQuery } from "../types/event.js";

// Without `to`, everything published: the pipeline keeps events up to a year ahead.
export const DEFAULT_WINDOW_DAYS = 366;
export const MAX_RESULTS = 1000;
// Events with no end time count as ongoing for this long after they start.
export const ASSUMED_DURATION_MS = 60 * 60 * 1000;

const isPublicAudience = (audience: Audience): boolean =>
  (PUBLIC_AUDIENCES as readonly Audience[]).includes(audience);

const effectiveEnd = (event: Event): Date =>
  event.endTime ?? new Date(event.startTime.getTime() + ASSUMED_DURATION_MS);

// Lowercases, folds curly apostrophes into straight ones, and drops accents, so
// "dean's" matches "Dean’s" and "cafe" matches "Café". The app's own search box
// does the same (frontend/src/features/events/filterEvents.ts).
const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u02bc\u2032]/g, "'");

// Every word of the search appears somewhere in the event's text, in any order.
const matchesText = (event: Event, words: string[]): boolean => {
  const text = normalizeText(
    [event.title, event.description, event.hostOrg, event.locationName, event.foodDetails].filter(Boolean).join(" "),
  );
  return words.every((word) => text.includes(word));
};

// Events for GET /api/events: overlapping [from, to), matching the optional
// filters, soonest first. The snapshot holds only publishable food events, but
// the audience check stays as a second line of defense.
export const selectEvents = (events: Event[], query: EventQuery, now: Date): Event[] => {
  const from = query.from ?? now;
  const to = query.to ?? addDays(from, DEFAULT_WINDOW_DAYS);
  const words = normalizeText(query.q ?? "").split(/\s+/).filter(Boolean);

  return events
    .filter(
      (event) =>
        isPublicAudience(event.audience) &&
        (query.audience === undefined || event.audience === query.audience) &&
        event.startTime < to &&
        effectiveEnd(event) >= from &&
        (query.minConfidence === undefined || event.foodConfidence >= query.minConfidence) &&
        (words.length === 0 || matchesText(event, words)),
    )
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .slice(0, MAX_RESULTS);
};
