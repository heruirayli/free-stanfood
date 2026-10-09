import { describe, expect, it } from "vitest";
import { makePublished } from "../../__tests__/factories.js";
import { eventQuerySchema, type EventQuery } from "../../types/event.js";
import { selectEvents } from "../eventFilter.js";

const NOW = new Date("2026-10-01T18:00:00Z"); // 11:00 PDT

const events = [
  makePublished("upcoming", { title: "Pizza and pitch night", foodDetails: "pizza" }),
  makePublished("happening", {
    startTime: new Date("2026-10-01T17:00:00Z"),
    endTime: new Date("2026-10-01T19:00:00Z"),
  }),
  makePublished("ended", {
    startTime: new Date("2026-10-01T15:00:00Z"),
    endTime: new Date("2026-10-01T16:00:00Z"),
  }),
  makePublished("no-end-recent", { startTime: new Date("2026-10-01T17:30:00Z"), endTime: null }),
  makePublished("no-end-old", { startTime: new Date("2026-10-01T15:00:00Z"), endTime: null }),
  makePublished("far-future", {
    startTime: new Date("2028-01-10T19:00:00Z"),
    endTime: new Date("2028-01-10T20:00:00Z"),
  }),
  makePublished("low", { foodConfidence: 0.3 }),
  makePublished("restricted", { audience: "restricted" }),
  makePublished("rsvp", { audience: "rsvp", hostOrg: "Boba Club" }),
];

const parse = (params: Record<string, string>): EventQuery => eventQuerySchema.parse(params);

const find = (params: Record<string, string>): string[] =>
  selectEvents(events, parse(params), NOW)
    .map((event) => event.sourceEventId)
    .sort();

describe("selectEvents", () => {
  it("defaults to current and upcoming public events", () => {
    expect(find({})).toEqual(["happening", "low", "no-end-recent", "rsvp", "upcoming"]);
  });

  it("sorts soonest first", () => {
    const ids = selectEvents(events, parse({}), NOW).map((event) => event.sourceEventId);
    expect(ids[0]).toBe("happening");
    expect(ids[1]).toBe("no-end-recent");
  });

  it("filters by minimum confidence", () => {
    expect(find({ minConfidence: "0.5" })).not.toContain("low");
  });

  it("filters by audience", () => {
    expect(find({ audience: "rsvp" })).toEqual(["rsvp"]);
  });

  it("searches title, host, and food details case-insensitively", () => {
    expect(find({ q: "PIZZA" })).toContain("upcoming");
    expect(find({ q: "boba club" })).toEqual(["rsvp"]);
  });

  it("matches every word of the search, in any order", () => {
    expect(find({ q: "night pizza" })).toEqual(["upcoming"]);
    expect(find({ q: "pizza sushi" })).toEqual([]);
  });

  it("ignores accents and curly apostrophes", () => {
    const list = [
      makePublished("cafe", { title: "Café night" }),
      makePublished("dean", { title: "Dean’s lunch" }),
    ];
    const search = (q: string) => selectEvents(list, { q }, NOW).map((event) => event.sourceEventId);
    expect(search("cafe")).toEqual(["cafe"]);
    expect(search("dean's")).toEqual(["dean"]);
  });

  it("treats search text literally", () => {
    expect(find({ q: ".*" })).toEqual([]);
  });

  it("respects an explicit window", () => {
    expect(find({ from: "2028-01-01T00:00:00Z", to: "2028-02-01T00:00:00Z" })).toEqual(["far-future"]);
  });

  it("never returns restricted events", () => {
    expect(find({ from: "2026-01-01T00:00:00Z", to: "2029-01-01T00:00:00Z" })).not.toContain("restricted");
  });
});

describe("eventQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(parse({})).toEqual({});
  });

  it("reads a plain date as campus midnight and keeps explicit offsets", () => {
    expect(parse({ from: "2026-10-01", to: "2026-10-02T12:00:00-07:00" })).toEqual({
      from: new Date("2026-10-01T07:00:00Z"),
      to: new Date("2026-10-02T19:00:00Z"),
    });
  });

  it.each([
    [{ from: "not a date" }],
    [{ from: "October 1, 2026" }],
    [{ from: "2026-10-01T12:00:00" }],
    [{ minConfidence: "2" }],
    [{ audience: "restricted" }],
    [{ from: "2026-10-02T00:00:00Z", to: "2026-10-01T00:00:00Z" }],
    [{ q: "x".repeat(101) }],
  ])("rejects %o", (params) => {
    expect(eventQuerySchema.safeParse(params).success).toBe(false);
  });
});
