import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeEvent } from "../../testUtils";
import {
  campusDateKey,
  formatEventTime,
  fromCampusWallClock,
  isHappeningNow,
  lastCampusDateKey,
  startOfCampusDay,
  timeOfDay,
  toCampusWallClock,
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

  it("names the end day for events that span days", () => {
    const now = new Date("2026-10-09T19:00:00Z"); // Fri, Oct 9, noon PDT
    const hackathon = makeEvent({ startTime: "2026-10-10T00:00:00Z", endTime: "2026-10-11T19:00:00Z" });
    expect(formatEventTime(hackathon, now)).toBe("Today · 5:00 PM – Sun, Oct 11 · 12:00 PM");
    const retreat = makeEvent({ startTime: "2026-10-30T07:00:00Z", endTime: "2026-11-01T06:59:00Z", allDay: true });
    expect(formatEventTime(retreat, new Date("2026-10-31T19:00:00Z"))).toBe("Fri, Oct 30 – Today · All day");
    // Ending at midnight stays on the start day.
    const late = makeEvent({ startTime: "2026-10-10T05:00:00Z", endTime: "2026-10-10T07:00:00Z" });
    expect(formatEventTime(late, now)).toBe("Today · 10:00 PM – 12:00 AM");
  });

  it("finds an event's last campus day", () => {
    expect(lastCampusDateKey(makeEvent({ startTime: "2026-10-01T07:00:00Z", endTime: "2026-10-02T06:59:00Z", allDay: true }))).toBe(
      "2026-10-01",
    );
    expect(lastCampusDateKey(makeEvent({ startTime: "2026-10-30T07:00:00Z", endTime: "2026-11-01T06:59:00Z", allDay: true }))).toBe(
      "2026-10-31",
    );
    expect(lastCampusDateKey(makeEvent({ endTime: null }))).toBe("2026-10-01");
  });
});

// The calendar is fed campus wall-clock times, so these must not depend on the device's zone.
describe.each([
  ["America/Los_Angeles", 480],
  ["America/New_York", 300],
  ["Asia/Tokyo", -540],
  ["UTC", 0],
])("campus wall clock on a device in %s", (zone, januaryOffset) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = original;
  });

  it("converts to and from campus wall-clock time", () => {
    expect(new Date("2026-01-01T00:00:00Z").getTimezoneOffset()).toBe(januaryOffset); // the zone took effect
    expect(toCampusWallClock("2026-09-30T17:30:00Z")).toBe("2026-09-30T10:30:00");
    expect(fromCampusWallClock(new Date("2026-09-27T00:00:00Z")).toISOString()).toBe("2026-09-27T07:00:00.000Z");
    // After the DST change, campus midnight is 08:00 UTC.
    expect(fromCampusWallClock(new Date("2026-11-08T00:00:00Z")).toISOString()).toBe("2026-11-08T08:00:00.000Z");
  });
});
