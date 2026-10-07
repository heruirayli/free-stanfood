import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { addDays, format, isValid, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { normalizedEventSchema, type NormalizedEvent } from "../types/event.js";

// Shared helpers every adapter uses to turn raw source data into a NormalizedEvent.

export const SOURCE_TIME_ZONE = "America/Los_Angeles";
export const MAX_DESCRIPTION_LENGTH = 5000;
// How far ahead every source looks: a year, plus today. Stanford Events (Localist)
// accepts at most 370 days per request; with yesterday and today the window is 367.
export const DAYS_AHEAD = 365;

const BLOCK_ELEMENTS = "p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote, section, article";
const INVISIBLE_CHARS = /[​-‍⁠﻿]/g;

// Stable 24-char id derived from source + sourceEventId, so re-runs map to the same document.
export const eventId = (source: string, sourceEventId: string): string =>
  createHash("sha256").update(`${source}:${sourceEventId}`).digest("hex").slice(0, 24);

// Converts an HTML fragment to plain text, keeping paragraph breaks and decoding entities.
export const htmlToText = (html: string | null | undefined): string => {
  if (!html) return "";
  const $ = cheerio.load(html, null, false);
  $("script, style, noscript").remove();
  $("br").replaceWith("\n");
  $(BLOCK_ELEMENTS).append("\n");

  return $.root()
    .text()
    .replace(INVISIBLE_CHARS, "")
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);
};

// For single-line fields like titles: strips tags, decodes entities, collapses whitespace.
export const cleanInlineText = (value: string | null | undefined): string =>
  htmlToText(value).replace(/\s+/g, " ").trim();

export const nullIfEmpty = (value: string | null | undefined): string | null => {
  const cleaned = cleanInlineText(value);
  return cleaned.length > 0 ? cleaned : null;
};

const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

// Parses a source timestamp. Strings with an explicit offset are taken as-is;
// strings without one are interpreted as wall-clock time in `timeZone`.
// Date-only strings mean local midnight. Returns null if unparseable.
export const parseSourceTime = (
  value: string | null | undefined,
  timeZone: string = SOURCE_TIME_ZONE,
): Date | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  let date: Date;
  if (HAS_OFFSET.test(trimmed)) {
    date = parseISO(trimmed);
  } else if (DATE_ONLY.test(trimmed)) {
    date = fromZonedTime(`${trimmed}T00:00:00`, timeZone);
  } else if (LOCAL_DATE_TIME.test(trimmed)) {
    date = fromZonedTime(trimmed.replace(" ", "T"), timeZone);
  } else {
    return null;
  }
  return isValid(date) ? date : null;
};

// 23:59 on the campus-time day containing `date`. Used as the end of all-day
// events that have no end time (the same convention Localist uses when it has one).
export const endOfSourceDay = (date: Date, timeZone: string = SOURCE_TIME_ZONE): Date =>
  fromZonedTime(`${formatInTimeZone(date, timeZone, "yyyy-MM-dd")}T23:59:00`, timeZone);

// True when `end` is the same wall-clock time as `start`, one campus day later
// (e.g. Thu 12:00 PM -> Fri 12:00 PM). Compared in campus time, so it also holds
// across a DST change, when that span is 23 or 25 hours.
export const isSameTimeNextDay = (start: Date, end: Date, timeZone: string = SOURCE_TIME_ZONE): boolean => {
  if (formatInTimeZone(start, timeZone, "HH:mm") !== formatInTimeZone(end, timeZone, "HH:mm")) return false;
  const nextDay = format(addDays(parseISO(formatInTimeZone(start, timeZone, "yyyy-MM-dd")), 1), "yyyy-MM-dd");
  return formatInTimeZone(end, timeZone, "yyyy-MM-dd") === nextDay;
};

// Picks the end time to store for an event:
// - All-day events without a usable end run to 23:59 on their day.
// - Timed events whose end isn't after the start have no known end.
// - Timed events ending at the same clock time the next day are almost always a
//   host picking the wrong end date (a noon talk listed as noon to noon Friday),
//   so the end is treated as unknown. Consumers then assume about an hour. A real
//   24-hour event loses its end time, but its start and source link stay correct.
export const resolveEndTime = (start: Date, end: Date | null, allDay: boolean): Date | null => {
  const usable = end && end > start ? end : null;
  if (allDay) return usable ?? endOfSourceDay(start);
  if (!usable || isSameTimeNextDay(start, usable)) return null;
  return usable;
};

export const parseCoordinate = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const logSkip = (source: string, rawId: string, reason: string): void => {
  console.warn(`[${source}] skipped ${rawId}: ${reason}`);
};

// Final gate before an adapter returns: never let an invalid record through.
export const validateNormalized = (
  source: string,
  rawId: string,
  candidate: unknown,
): NormalizedEvent | null => {
  const result = normalizedEventSchema.safeParse(candidate);
  if (!result.success) {
    const reasons = result.error.issues
      .map((issue) => `${issue.path.join(".") || "event"}: ${issue.message}`)
      .join("; ");
    logSkip(source, rawId, reasons);
    return null;
  }
  return result.data;
};
