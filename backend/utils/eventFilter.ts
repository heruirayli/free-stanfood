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

const matchesText = (event: Event, text: string): boolean =>
  [event.title, event.description, event.hostOrg, event.locationName, event.foodDetails].some((field) =>
    field?.toLowerCase().includes(text),
  );

// Events for GET /api/events: overlapping [from, to), matching the optional
// filters, soonest first. The snapshot holds only publishable food events, but
// the audience check stays as a second line of defense.
export const selectEvents = (events: Event[], query: EventQuery, now: Date): Event[] => {
  const from = query.from ?? now;
  const to = query.to ?? addDays(from, DEFAULT_WINDOW_DAYS);
  const text = query.q?.toLowerCase();

  return events
    .filter(
      (event) =>
        isPublicAudience(event.audience) &&
        (query.audience === undefined || event.audience === query.audience) &&
        event.startTime < to &&
        effectiveEnd(event) >= from &&
        (query.minConfidence === undefined || event.foodConfidence >= query.minConfidence) &&
        (!text || matchesText(event, text)),
    )
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .slice(0, MAX_RESULTS);
};
