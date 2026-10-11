import { describe, expect, it } from "vitest";
import { makeEvent } from "../../../testUtils";
import { toCalendarEvent, weekStep } from "../calendarEvents";

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

describe("weekStep", () => {
  // The calendar's dates: campus dates at UTC midnight.
  const day = (date: string) => new Date(`${date}T00:00:00Z`);

  it("goes forward from today to the next Sunday-to-Saturday week, skipping no day", () => {
    expect(weekStep(day("2026-10-08"), 1)).toBe("2026-10-11"); // Thursday -> Sunday after
    expect(weekStep(day("2026-10-11"), 1)).toBe("2026-10-18"); // Sunday -> next Sunday
  });

  it("goes back to the Sunday on or before, then a week at a time", () => {
    expect(weekStep(day("2026-10-08"), -1)).toBe("2026-10-04"); // Thursday -> its Sunday
    expect(weekStep(day("2026-10-04"), -1)).toBe("2026-09-27"); // Sunday -> the Sunday before
  });

  it("crosses months and the end of daylight saving time", () => {
    expect(weekStep(day("2026-10-30"), 1)).toBe("2026-11-01");
    expect(weekStep(day("2026-11-01"), 1)).toBe("2026-11-08");
  });
});
