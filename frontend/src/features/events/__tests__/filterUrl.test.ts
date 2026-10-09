import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "../filterEvents";
import { filtersFromParams, filtersToParams, sharedFilterSearch } from "../filterUrl";

const parse = (search: string, scope: "today" | "calendar") => filtersFromParams(new URLSearchParams(search), scope);

describe("filter URLs", () => {
  it("leaves the defaults out", () => {
    expect(filtersToParams(DEFAULT_FILTERS, "today").toString()).toBe("");
    expect(filtersToParams(DEFAULT_FILTERS, "calendar").toString()).toBe("");
  });

  it("writes each filter, with the page's own time filter", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      query: "y2e2",
      openOnly: true,
      foodTypes: ["pizza", "boba"],
      window: "next2h" as const,
      timesOfDay: ["evening" as const, "morning" as const],
      showLowConfidence: true,
    };
    expect(Object.fromEntries(filtersToParams(filters, "today"))).toEqual({
      q: "y2e2",
      open: "1",
      food: "pizza,boba",
      possible: "1",
      when: "2h",
    });
    // Times in the day's order, whatever order they were chosen in.
    expect(Object.fromEntries(filtersToParams(filters, "calendar"))).toMatchObject({ time: "morning,evening" });
    expect(filtersToParams(filters, "calendar").has("when")).toBe(false);
  });

  it("reads them back", () => {
    expect(parse("q=y2e2&open=1&food=pizza,boba&possible=1&when=now", "today")).toEqual({
      query: "y2e2",
      openOnly: true,
      foodTypes: ["pizza", "boba"],
      showLowConfidence: true,
      window: "now",
    });
    expect(parse("time=midday", "calendar")).toMatchObject({ timesOfDay: ["midday"] });
    expect(parse("time=evening,morning", "calendar")).toMatchObject({ timesOfDay: ["morning", "evening"] });
  });

  it("resets what the URL leaves out, and ignores values it doesn't know", () => {
    expect(parse("", "today")).toEqual({
      query: "",
      openOnly: false,
      foodTypes: [],
      showLowConfidence: false,
      window: "today",
    });
    expect(parse("when=tomorrow&open=yes", "today")).toMatchObject({ window: "today", openOnly: false });
    expect(parse("time=toString", "calendar")).toMatchObject({ timesOfDay: [] });
    expect(parse("time=noon,evening", "calendar")).toMatchObject({ timesOfDay: ["evening"] });
    expect(parse("food=Pizza,,pizza, boba", "today")).toMatchObject({ foodTypes: ["pizza", "boba"] });
  });

  it("round-trips", () => {
    const filters = { ...DEFAULT_FILTERS, query: "free lunch & more", foodTypes: ["happy hour"], window: "now" as const };
    expect(parse(filtersToParams(filters, "today").toString(), "today")).toMatchObject({
      query: "free lunch & more",
      foodTypes: ["happy hour"],
      window: "now",
    });
  });

  it("carries only the shared filters between pages", () => {
    expect(sharedFilterSearch(DEFAULT_FILTERS)).toBe("");
    expect(sharedFilterSearch({ ...DEFAULT_FILTERS, foodTypes: ["pizza"], window: "now", timesOfDay: ["evening"] })).toBe(
      "?food=pizza",
    );
  });
});
