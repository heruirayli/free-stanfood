import { eventId } from "../pipeline/normalize.js";
import type { ClassifiedEvent } from "../pipeline/snapshot.js";
import type { Event } from "../types/event.js";

export const makeClassified = (
  sourceEventId: string,
  overrides: Partial<ClassifiedEvent> = {},
): ClassifiedEvent => ({
  source: "localist",
  sourceEventId,
  sourceUrl: `https://events.example.edu/event/${sourceEventId}`,
  title: `Event ${sourceEventId}`,
  description: "Pizza provided.",
  startTime: new Date("2026-10-01T19:00:00Z"),
  endTime: new Date("2026-10-01T20:00:00Z"),
  allDay: false,
  locationName: "Y2E2",
  lat: null,
  lng: null,
  hostOrg: null,
  audience: "open",
  audienceNote: null,
  cost: null,
  isVirtual: false,
  hasFreeFood: true,
  foodConfidence: 0.9,
  foodDetails: "pizza",
  classifiedBy: "keywords",
  ...overrides,
});

export const makePublished = (
  sourceEventId: string,
  overrides: Partial<Event> = {},
  firstSeenAt: Date = new Date("2026-09-28T10:00:00Z"),
): Event => {
  const base = makeClassified(sourceEventId, overrides);
  return {
    ...base,
    id: eventId(base.source, base.sourceEventId),
    firstSeenAt,
    ...overrides,
  };
};
