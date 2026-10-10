import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Audience, Event } from "../types/event.js";
import { ASSUMED_DURATION_MS } from "./eventFilter.js";

// Builds an iCalendar (RFC 5545) file of events for GET /api/events/calendar.ics.
// Google Calendar imports it (Settings > Import & export) or subscribes to its URL.
// Written by hand rather than with a library: the format is small and fixed.

const CAMPUS_TIME_ZONE = "America/Los_Angeles";
const DESCRIPTION_CHARS = 1500;

// Like the app's default view, the calendar file leaves out "Food possible"
// matches unless the request asks for them with minConfidence.
export const CALENDAR_MIN_CONFIDENCE = 0.45;

// Confidence bands, as labeled in the app. Keep in sync with
// pipeline/classify/keywords.ts (the server never imports pipeline code).
const bandOf = (confidence: number): string =>
  confidence >= 0.75 ? "Food listed" : confidence >= 0.45 ? "Food likely" : "Food possible";

const AUDIENCE_LABELS: Record<Audience, string> = {
  open: "Open to all",
  rsvp: "RSVP required",
  restricted: "Restricted",
  unknown: "Audience unknown",
};

// TEXT values escape backslashes, semicolons, commas and newlines.
export const escapeText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 octets continue on the next line after a space. Splits
// between characters, never inside a multi-byte UTF-8 sequence.
export const foldLine = (line: string): string => {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
};

const utcStamp = (date: Date): string => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const campusDate = (date: Date): string => formatInTimeZone(date, CAMPUS_TIME_ZONE, "yyyyMMdd");

// The calendar date after `date`'s campus date. Done on dates, not instants, so a
// DST change can't move it.
const campusDayAfter = (date: Date): string => {
  const day = new Date(`${formatInTimeZone(date, CAMPUS_TIME_ZONE, "yyyy-MM-dd")}T00:00:00Z`);
  return addDays(day, 1).toISOString().slice(0, 10).replace(/-/g, "");
};

// All-day events use calendar dates with an exclusive end: the day after the last day.
const timeLines = (event: Event): string[] => {
  if (event.allDay) {
    return [
      `DTSTART;VALUE=DATE:${campusDate(event.startTime)}`,
      `DTEND;VALUE=DATE:${campusDayAfter(event.endTime ?? event.startTime)}`,
    ];
  }
  const end = event.endTime ?? new Date(event.startTime.getTime() + ASSUMED_DURATION_MS);
  return [`DTSTART:${utcStamp(event.startTime)}`, `DTEND:${utcStamp(end)}`];
};

const descriptionOf = (event: Event): string => {
  const food = event.foodDetails ? `Food: ${event.foodDetails} (${bandOf(event.foodConfidence)})` : bandOf(event.foodConfidence);
  const audience = event.audienceNote
    ? `${AUDIENCE_LABELS[event.audience]} (${event.audienceNote})`
    : AUDIENCE_LABELS[event.audience];
  const details = event.description.length > DESCRIPTION_CHARS
    ? `${event.description.slice(0, DESCRIPTION_CHARS).trimEnd()}…`
    : event.description;
  return [
    food,
    audience,
    event.hostOrg ? `Host: ${event.hostOrg}` : null,
    "Food isn't guaranteed. Check the original listing before you go.",
    details ? `\n${details}` : null,
    `\nOriginal listing: ${event.sourceUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
};

export interface CalendarOptions {
  // A reminder this many minutes before each timed event. All-day events get
  // none: half an hour before midnight helps no one.
  alarmMinutes?: number;
}

const alarmLines = (event: Event, minutes: number | undefined): string[] =>
  minutes && !event.allDay
    ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(event.title)}`, `TRIGGER:-PT${minutes}M`, "END:VALARM"]
    : [];

const eventLines = (event: Event, stamp: string, options: CalendarOptions): string[] => [
  "BEGIN:VEVENT",
  `UID:${event.id}@free-stanfood`,
  `DTSTAMP:${stamp}`,
  ...timeLines(event),
  `SUMMARY:${escapeText(event.title)}`,
  ...(event.locationName ? [`LOCATION:${escapeText(event.locationName)}`] : []),
  `DESCRIPTION:${escapeText(descriptionOf(event))}`,
  `URL:${event.sourceUrl}`,
  ...alarmLines(event, options.alarmMinutes),
  "END:VEVENT",
];

export const buildCalendar = (events: Event[], now: Date, options: CalendarOptions = {}): string => {
  const stamp = utcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Free Stanfood//Free food events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Free Stanfood",
    `X-WR-TIMEZONE:${CAMPUS_TIME_ZONE}`,
    ...events.flatMap((event) => eventLines(event, stamp, options)),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
};
