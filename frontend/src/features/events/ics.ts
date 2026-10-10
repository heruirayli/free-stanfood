import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ASSUMED_DURATION_MS, CAMPUS_TIME_ZONE, LIKELY_THRESHOLD, LISTED_THRESHOLD } from "../../constants";
import type { Audience, FoodEvent } from "../../types/event";

// Builds .ics files in the browser, for a static host with no API to serve them
// (see staticCalendar.ts). Mirrors backend/utils/ics.ts: keep the two in sync.

const DESCRIPTION_CHARS = 1500;

const bandOf = (confidence: number): string =>
  confidence >= LISTED_THRESHOLD ? "Food listed" : confidence >= LIKELY_THRESHOLD ? "Food likely" : "Food possible";

const AUDIENCE_LABELS: Record<Audience, string> = {
  open: "Open to all",
  rsvp: "RSVP required",
  restricted: "Restricted",
  unknown: "Audience unknown",
};

// TEXT values escape backslashes, semicolons, commas and newlines.
export const escapeText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const encoder = new TextEncoder();

// Lines longer than 75 octets continue on the next line after a space. Splits
// between characters, never inside a multi-byte UTF-8 sequence.
export const foldLine = (line: string): string => {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
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

// The calendar date after `date`'s campus date, done on dates so DST can't move it.
const campusDayAfter = (date: Date): string => {
  const day = new Date(`${formatInTimeZone(date, CAMPUS_TIME_ZONE, "yyyy-MM-dd")}T00:00:00Z`);
  return addDays(day, 1).toISOString().slice(0, 10).replace(/-/g, "");
};

const timeLines = (event: FoodEvent): string[] => {
  const start = new Date(event.startTime);
  if (event.allDay) {
    return [`DTSTART;VALUE=DATE:${campusDate(start)}`, `DTEND;VALUE=DATE:${campusDayAfter(new Date(event.endTime ?? event.startTime))}`];
  }
  const end = event.endTime ? new Date(event.endTime) : new Date(start.getTime() + ASSUMED_DURATION_MS);
  return [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`];
};

const descriptionOf = (event: FoodEvent): string => {
  const food = event.foodDetails ? `Food: ${event.foodDetails} (${bandOf(event.foodConfidence)})` : bandOf(event.foodConfidence);
  const audience = event.audienceNote
    ? `${AUDIENCE_LABELS[event.audience]} (${event.audienceNote})`
    : AUDIENCE_LABELS[event.audience];
  const details =
    event.description.length > DESCRIPTION_CHARS
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
  // A reminder this many minutes before each timed event (not all-day ones).
  alarmMinutes?: number;
}

const alarmLines = (event: FoodEvent, minutes: number | undefined): string[] =>
  minutes && !event.allDay
    ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(event.title)}`, `TRIGGER:-PT${minutes}M`, "END:VALARM"]
    : [];

const eventLines = (event: FoodEvent, stamp: string, options: CalendarOptions): string[] => [
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

export const buildCalendar = (events: FoodEvent[], now: Date, options: CalendarOptions = {}): string => {
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
