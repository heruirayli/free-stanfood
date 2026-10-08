import { describe, expect, it } from "vitest";
import { makeEvent } from "../../../testUtils";
import {
  DEFAULT_FILTERS,
  applyFilters,
  foodTypesIn,
  hasActiveFilters,
  matchesTimeOfDay,
  matchesWindow,
} from "../filterEvents";

const events = [
  makeEvent({ id: "pizza", foodDetails: "pizza", foodConfidence: 0.9, audience: "open" }),
  makeEvent({
    id: "boba",
    title: "Boba social",
    foodDetails: "boba, snacks",
    foodConfidence: 0.6,
    startTime: "2026-10-02T01:00:00Z", // 6 PM PDT
    hostOrg: "Taiwanese Student Association",
    audience: "rsvp",
  }),
  makeEvent({ id: "coffee", title: "Coffee hour", foodDetails: "coffee", foodConfidence: 0.25, audience: "unknown" }),
];

const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe("applyFilters", () => {
  it("hides low-confidence events by default", () => {
    expect(ids(applyFilters(events, DEFAULT_FILTERS))).toEqual(["pizza", "boba"]);
  });

  it("shows low-confidence events when toggled", () => {
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, showLowConfidence: true }))).toEqual([
      "pizza",
      "boba",
      "coffee",
    ]);
  });

  it("keeps only events open to all", () => {
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, openOnly: true, showLowConfidence: true }))).toEqual(["pizza"]);
  });

  it("matches any of the chosen food types", () => {
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, foodTypes: ["snacks"] }))).toEqual(["boba"]);
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, foodTypes: ["snacks", "pizza"] }))).toEqual(["pizza", "boba"]);
  });

  it("searches across fields, requiring every word", () => {
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, query: "taiwanese boba" }))).toEqual(["boba"]);
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, query: "y2e2" }))).toEqual(["pizza", "boba"]);
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, query: "sushi" }))).toEqual([]);
  });

  it("matches curly and straight apostrophes, and ignores accents", () => {
    const list = [
      makeEvent({ id: "curly", title: "Dean’s Lecture Series", description: "" }),
      makeEvent({ id: "straight", title: "Women's Center open house", description: "" }),
      makeEvent({ id: "cafe", title: "Café night", description: "" }),
    ];
    expect(ids(applyFilters(list, { ...DEFAULT_FILTERS, query: "dean's" }))).toEqual(["curly"]);
    expect(ids(applyFilters(list, { ...DEFAULT_FILTERS, query: "women’s" }))).toEqual(["straight"]);
    expect(ids(applyFilters(list, { ...DEFAULT_FILTERS, query: "cafe" }))).toEqual(["cafe"]);
  });
});

describe("matchesWindow", () => {
  const now = new Date("2026-10-01T19:30:00Z"); // 12:30 PM PDT
  const lunch = makeEvent({ startTime: "2026-10-01T19:00:00Z", endTime: "2026-10-01T20:00:00Z" });
  const soon = makeEvent({ startTime: "2026-10-01T21:00:00Z", endTime: null }); // 2 PM
  const later = makeEvent({ startTime: "2026-10-01T23:00:00Z", endTime: null }); // 4 PM
  const allDay = makeEvent({ startTime: "2026-10-01T07:00:00Z", endTime: "2026-10-02T06:59:00Z", allDay: true });

  it("keeps everything for today", () => {
    expect([lunch, soon, later, allDay].every((e) => matchesWindow(e, "today", now))).toBe(true);
  });

  it("keeps what's on now, including all-day events", () => {
    expect([lunch, soon, later, allDay].map((e) => matchesWindow(e, "now", now))).toEqual([true, false, false, true]);
  });

  it("adds what starts within two hours", () => {
    expect([lunch, soon, later, allDay].map((e) => matchesWindow(e, "next2h", now))).toEqual([true, true, false, true]);
  });
});

describe("matchesTimeOfDay", () => {
  it("filters by the campus hour of the start, leaving out all-day events", () => {
    const evening = makeEvent({ startTime: "2026-10-02T01:00:00Z" }); // 6 PM PDT
    expect(matchesTimeOfDay(evening, "evening")).toBe(true);
    expect(matchesTimeOfDay(evening, "midday")).toBe(false);
    expect(matchesTimeOfDay(makeEvent({ allDay: true }), "morning")).toBe(false);
    expect(matchesTimeOfDay(makeEvent({ allDay: true }), "any")).toBe(true);
  });
});

describe("foodTypesIn", () => {
  it("lists food types by frequency", () => {
    const list = [...events, makeEvent({ id: "p2", foodDetails: "pizza, snacks" })];
    expect(foodTypesIn(list)).toEqual(["pizza", "snacks", "boba", "coffee"]);
  });
});

describe("hasActiveFilters", () => {
  it("ignores the low-confidence toggle", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS, "today")).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, showLowConfidence: true }, "today")).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: "pizza" }, "today")).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, openOnly: true }, "calendar")).toBe(true);
  });

  it("counts only the page's own time filter", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, window: "now" }, "today")).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, window: "now" }, "calendar")).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, timeOfDay: "evening" }, "calendar")).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, timeOfDay: "evening" }, "today")).toBe(false);
  });
});
