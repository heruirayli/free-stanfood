import { describe, expect, it } from "vitest";
import { makeEvent } from "../../../testUtils";
import { DEFAULT_FILTERS, applyFilters, foodTypesIn, hasActiveFilters } from "../filterEvents";

const events = [
  makeEvent({ id: "pizza", foodDetails: "pizza", foodConfidence: 0.9 }),
  makeEvent({
    id: "boba",
    title: "Boba social",
    foodDetails: "boba, snacks",
    foodConfidence: 0.6,
    startTime: "2026-10-02T01:00:00Z", // 6 PM PDT
    hostOrg: "Taiwanese Student Association",
  }),
  makeEvent({ id: "coffee", title: "Coffee hour", foodDetails: "coffee", foodConfidence: 0.25 }),
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

  it("filters by food type", () => {
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, foodType: "snacks" }))).toEqual(["boba"]);
  });

  it("filters by time of day", () => {
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, timeOfDay: "evening" }))).toEqual(["boba"]);
  });

  it("searches across fields, requiring every word", () => {
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, query: "taiwanese boba" }))).toEqual(["boba"]);
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, query: "y2e2" }))).toEqual(["pizza", "boba"]);
    expect(ids(applyFilters(events, { ...DEFAULT_FILTERS, query: "sushi" }))).toEqual([]);
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
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, showLowConfidence: true })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: "pizza" })).toBe(true);
  });
});
