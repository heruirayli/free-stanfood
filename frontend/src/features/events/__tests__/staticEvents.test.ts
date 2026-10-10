import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEvent } from "../../../testUtils";
import { buildCalendar, escapeText, foldLine } from "../ics";
import { staticCalendarFile } from "../staticCalendar";
import { selectStaticEvents } from "../staticEvents";

const NOW = new Date("2026-10-01T19:30:00Z"); // Oct 1, 12:30 PM PDT

const ids = (list: { id: string }[]) => list.map((e) => e.id);

const events = [
  makeEvent({ id: "later", startTime: "2026-10-01T23:00:00Z", endTime: null, foodConfidence: 0.5 }),
  makeEvent({ id: "now", startTime: "2026-10-01T19:00:00Z", endTime: "2026-10-01T20:00:00Z" }),
  makeEvent({ id: "over", startTime: "2026-10-01T16:00:00Z", endTime: "2026-10-01T17:00:00Z" }),
  makeEvent({ id: "weak", startTime: "2026-10-02T19:00:00Z", endTime: null, foodConfidence: 0.3, title: "Coffee hour" }),
  makeEvent({ id: "far", startTime: "2028-01-01T19:00:00Z" }),
];

describe("selectStaticEvents (the API's filtering, in the browser)", () => {
  it("returns events overlapping the window, soonest first", () => {
    expect(ids(selectStaticEvents(events, { from: "2026-10-01T07:00:00Z", to: "2026-10-02T07:00:00Z" }, NOW))).toEqual([
      "over",
      "now",
      "later",
    ]);
  });

  it("defaults to the year from now, as the API does", () => {
    expect(ids(selectStaticEvents(events, {}, NOW))).toEqual(["now", "later", "weak"]);
  });

  it("applies minConfidence, audience, and text search", () => {
    expect(ids(selectStaticEvents(events, { minConfidence: 0.45 }, NOW))).toEqual(["now", "later"]);
    expect(ids(selectStaticEvents(events, { q: "COFFEE" }, NOW))).toEqual(["weak"]);
    // Every word, in any order, as the API does.
    expect(ids(selectStaticEvents(events, { q: "hour coffee" }, NOW))).toEqual(["weak"]);
    const mixed = [makeEvent({ id: "rsvp", audience: "rsvp" }), makeEvent({ id: "open", audience: "open" })];
    expect(ids(selectStaticEvents(mixed, { audience: "open", from: "2026-10-01T00:00:00Z" }, NOW))).toEqual(["open"]);
  });
});

describe("calendar files in the browser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("escapes text and folds long lines between characters", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const folded = foldLine(`SUMMARY:${"é".repeat(60)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(60)}`);
  });

  it("writes timed and all-day events like the server does", () => {
    const allDay = makeEvent({ id: "fair", startTime: "2026-10-05T07:00:00Z", endTime: "2026-10-06T06:59:00Z", allDay: true });
    const ics = buildCalendar([makeEvent(), allDay], NOW);
    expect(ics).toContain("DTSTART:20261001T190000Z\r\nDTEND:20261001T200000Z");
    // All-day: the exclusive end is the day after the last day.
    expect(ics).toContain("DTSTART;VALUE=DATE:20261005\r\nDTEND;VALUE=DATE:20261006");
    expect(ics).toContain("SUMMARY:Pizza and pitch night");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("answers an export URL from the site's copy of the events", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: events });
    // The default leaves out "Food possible", as the API's does.
    const everything = await staticCalendarFile("/api/events/calendar.ics", NOW);
    expect(everything.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(everything).not.toContain("Coffee hour");

    const one = await staticCalendarFile(
      "/api/events/calendar.ics?ids=weak&from=2026-10-02T19:00:00.000Z&to=2026-10-02T19:00:00.001Z&minConfidence=0",
      NOW,
    );
    expect(one.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(one).toContain("SUMMARY:Coffee hour");

    // A reminder when the URL asks for one, as the API does.
    expect(one).not.toContain("VALARM");
    const reminded = await staticCalendarFile("/api/events/calendar.ics?ids=later&alarm=30", NOW);
    expect(reminded).toContain(
      "BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Pizza and pitch night\r\nTRIGGER:-PT30M\r\nEND:VALARM",
    );

    const allBut = await staticCalendarFile("/api/events/calendar.ics?exclude=later", NOW);
    expect(allBut.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
