import type { FoodEvent } from "./types/event";

export const makeEvent = (overrides: Partial<FoodEvent> = {}): FoodEvent => ({
  id: "a1b2c3d4e5f6a7b8c9d0e1f2",
  source: "localist",
  sourceEventId: "1",
  sourceUrl: "https://events.stanford.edu/event/pizza-night",
  title: "Pizza and pitch night",
  description: "Free pizza for everyone.",
  startTime: "2026-10-01T19:00:00.000Z", // 12:00 PM PDT
  endTime: "2026-10-01T20:00:00.000Z",
  allDay: false,
  locationName: "Y2E2 Building, Room 111",
  lat: null,
  lng: null,
  hostOrg: "Entrepreneurship Club",
  audience: "open",
  audienceNote: null,
  cost: null,
  isVirtual: false,
  hasFreeFood: true,
  foodConfidence: 0.9,
  foodDetails: "pizza",
  classifiedBy: "keywords",
  firstSeenAt: "2026-09-28T10:00:00.000Z",
  ...overrides,
});

// Opens the <details> around `summary` the way a browser does: sets `open` and
// fires "toggle". jsdom doesn't toggle <details> on a summary click.
export const openDetails = (summary: HTMLElement): void => {
  const details = summary.closest("details");
  if (!details) throw new Error("not inside a <details>");
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
};
