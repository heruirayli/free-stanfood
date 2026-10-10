import ical, { type VEvent } from "node-ical";
import { describe, expect, it } from "vitest";
import { makePublished } from "../../__tests__/factories.js";
import { buildCalendar, escapeText, foldLine } from "../ics.js";

const NOW = new Date("2026-10-06T12:00:00Z");

const lunch = makePublished("lunch", {
  title: "Pizza, Pitch; & Pals",
  description: "Join us for pizza.\nBring a friend.",
  startTime: new Date("2026-10-07T19:00:00Z"),
  endTime: new Date("2026-10-07T20:30:00Z"),
  locationName: "Huang 018",
  hostOrg: "Stanford Robotics Club",
  audience: "rsvp",
  foodDetails: "pizza",
  foodConfidence: 0.9,
});

// A two-day all-day event ending 23:59 campus time on Oct 31.
const retreat = makePublished("retreat", {
  title: "Officer retreat",
  allDay: true,
  startTime: new Date("2026-10-30T07:00:00Z"),
  endTime: new Date("2026-11-01T06:59:00Z"),
  locationName: null,
});

const isVEvent = (component: unknown): component is VEvent =>
  typeof component === "object" && component !== null && (component as { type?: unknown }).type === "VEVENT";

const parsedEvents = (text: string): VEvent[] => Object.values(ical.sync.parseICS(text)).filter(isVEvent);

describe("buildCalendar", () => {
  it("produces a calendar that a standard parser reads back", () => {
    const text = buildCalendar([lunch, retreat], NOW);
    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    const [first] = parsedEvents(text);
    expect(first).toMatchObject({ summary: "Pizza, Pitch; & Pals", location: "Huang 018", url: lunch.sourceUrl });
    expect(first?.uid).toBe(`${lunch.id}@free-stanfood`);
    expect(first?.start.toISOString()).toBe("2026-10-07T19:00:00.000Z");
    expect(first?.end?.toISOString()).toBe("2026-10-07T20:30:00.000Z");
  });

  it("describes the food, audience, host, and original listing", () => {
    const [first] = parsedEvents(buildCalendar([lunch], NOW));
    const description = String(first?.description);
    expect(description).toContain("Food: pizza (Food listed)");
    expect(description).toContain("RSVP required");
    expect(description).toContain("Host: Stanford Robotics Club");
    expect(description).toContain("Join us for pizza.\nBring a friend.");
    expect(description).toContain(`Original listing: ${lunch.sourceUrl}`);
  });

  it("writes all-day events as dates with an exclusive end, in campus time", () => {
    const text = buildCalendar([retreat], NOW);
    expect(text).toContain("DTSTART;VALUE=DATE:20261030");
    expect(text).toContain("DTEND;VALUE=DATE:20261101");
    expect(text).not.toContain("LOCATION:");
  });

  it("keeps the all-day end date across a DST change", () => {
    // Mar 13, 2027, all day; clocks spring forward early on Mar 14.
    const spring = makePublished("spring", {
      allDay: true,
      startTime: new Date("2027-03-13T08:00:00Z"),
      endTime: new Date("2027-03-14T06:59:00Z"),
    });
    expect(buildCalendar([spring], NOW)).toContain("DTEND;VALUE=DATE:20270314");
  });

  it("gives events without an end time an hour", () => {
    const open = makePublished("open-end", { startTime: new Date("2026-10-07T19:00:00Z"), endTime: null });
    expect(buildCalendar([open], NOW)).toContain("DTEND:20261007T200000Z");
  });

  it("adds a reminder before timed events when asked, never to all-day ones", () => {
    const text = buildCalendar([lunch, retreat], NOW, { alarmMinutes: 30 });
    const [timed, allDay] = parsedEvents(text);
    const alarms = (event: VEvent | undefined) => Object.values((event as { alarms?: unknown[] } | undefined)?.alarms ?? {});
    expect(text).toContain("BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Pizza\\, Pitch\\; & Pals\r\nTRIGGER:-PT30M\r\nEND:VALARM");
    expect(alarms(timed)).toHaveLength(1);
    expect(alarms(allDay)).toHaveLength(0);
    expect(buildCalendar([lunch], NOW)).not.toContain("VALARM");
  });

  it("is a valid empty calendar when there are no events", () => {
    expect(parsedEvents(buildCalendar([], NOW))).toEqual([]);
  });
});

describe("escapeText and foldLine", () => {
  it("escapes the characters iCalendar reserves", () => {
    expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const folded = foldLine(`SUMMARY:${"é".repeat(60)}`);
    for (const line of folded.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(60)}`);
  });
});
