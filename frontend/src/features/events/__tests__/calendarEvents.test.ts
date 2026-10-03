import { describe, expect, it } from "vitest";
import { makeEvent } from "../../../testUtils";
import { toCalendarEvent } from "../calendarEvents";

describe("toCalendarEvent", () => {
  it("passes timed events as campus wall-clock times", () => {
    expect(toCalendarEvent(makeEvent())).toMatchObject({
      start: "2026-10-01T12:00:00",
      end: "2026-10-01T13:00:00",
      allDay: false,
      classNames: ["food-listed"],
    });
    expect(toCalendarEvent(makeEvent({ endTime: null })).end).toBeUndefined();
  });

  it("gives all-day events an exclusive date-only end, keeping their last day", () => {
    // The iCal adapter's "Officer retreat": Oct 30–31, stored as ending 23:59 on Oct 31.
    const retreat = makeEvent({ startTime: "2026-10-30T07:00:00Z", endTime: "2026-11-01T06:59:00Z", allDay: true });
    expect(toCalendarEvent(retreat)).toMatchObject({ start: "2026-10-30", end: "2026-11-01", allDay: true });
    const oneDay = makeEvent({ startTime: "2026-10-05T07:00:00Z", endTime: "2026-10-06T06:59:00Z", allDay: true });
    expect(toCalendarEvent(oneDay)).toMatchObject({ start: "2026-10-05", end: "2026-10-06" });
  });
});
