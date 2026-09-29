import { describe, expect, it } from "vitest";
import { makeEvent } from "../../testUtils";
import {
  campusDateKey,
  formatEventTime,
  isHappeningNow,
  startOfCampusDay,
  timeOfDay,
} from "../time";

describe("campus time helpers", () => {
  it("uses the campus date, not UTC", () => {
    // 23:30 PDT on Sep 30 is Oct 1 in UTC.
    expect(campusDateKey("2026-10-01T06:30:00Z")).toBe("2026-09-30");
  });

  it("finds campus midnight across the DST change", () => {
    const now = new Date("2026-10-31T19:00:00Z"); // Oct 31, noon PDT
    expect(startOfCampusDay(now).toISOString()).toBe("2026-10-31T07:00:00.000Z");
    expect(startOfCampusDay(now, 1).toISOString()).toBe("2026-11-01T07:00:00.000Z");
    // Nov 1 has 25 hours; Nov 2 starts at 08:00 UTC (PST).
    expect(startOfCampusDay(now, 2).toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("buckets start times by campus hour", () => {
    expect(timeOfDay("2026-10-01T16:00:00Z")).toBe("morning"); // 9 AM
    expect(timeOfDay("2026-10-01T19:00:00Z")).toBe("midday"); // noon
    expect(timeOfDay("2026-10-01T22:30:00Z")).toBe("afternoon"); // 3:30 PM
    expect(timeOfDay("2026-10-02T01:00:00Z")).toBe("evening"); // 6 PM
  });

  it("formats event times relative to today", () => {
    const now = new Date("2026-10-01T16:00:00Z");
    expect(formatEventTime(makeEvent(), now)).toBe("Today · 12:00 PM – 1:00 PM");
    expect(formatEventTime(makeEvent({ endTime: null }), now)).toBe("Today · 12:00 PM");
    expect(
      formatEventTime(makeEvent({ startTime: "2026-10-02T19:00:00Z", endTime: null }), now),
    ).toBe("Tomorrow · 12:00 PM");
    expect(
      formatEventTime(makeEvent({ startTime: "2026-10-05T07:00:00Z", allDay: true }), now),
    ).toBe("Mon, Oct 5 · All day");
  });

  it("detects happening-now events, assuming an hour when there is no end", () => {
    const event = makeEvent({ endTime: null });
    expect(isHappeningNow(event, new Date("2026-10-01T19:30:00Z"))).toBe(true);
    expect(isHappeningNow(event, new Date("2026-10-01T20:30:00Z"))).toBe(false);
    expect(isHappeningNow(event, new Date("2026-10-01T18:59:00Z"))).toBe(false);
    expect(isHappeningNow(makeEvent({ allDay: true }), new Date("2026-10-01T19:30:00Z"))).toBe(false);
  });
});
