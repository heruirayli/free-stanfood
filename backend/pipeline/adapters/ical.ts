// Source type: public iCalendar (.ics) subscription feeds, such as Luma calendars
// ("Add iCal Subscription", offered to signed-out visitors) and public Google
// Calendars. A published calendar feed is third in our preference order, after an
// official API and a discovered JSON endpoint, and needs no page scraping.
//
// Each feed is its own adapter (source "ical:<feed id>"), so one broken feed can't
// hide the others and keeps its previously published events when it fails.
// Feeds are listed in icalFeeds.ts along with how each was found and verified.
//
// Verified against real feeds on 2026-09-30 (see fixtures/luma-*.ics):
// - Luma feeds give UTC times, STATUS:TENTATIVE on everything, GEO coordinates,
//   and a DESCRIPTION that is only the event link, address, and host. The event's
//   own write-up isn't in the feed, so food detection mostly sees the title.
// - node-ical expands RRULEs across DST correctly, applies EXDATE and
//   RECURRENCE-ID overrides, and represents all-day dates as local midnight
//   (read them with local getters). See fixtures/ical-edge-cases.ics.

import { addDays, subDays, subMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import ical, { type EventInstance, type ParameterValue, type VEvent } from "node-ical";
import { z } from "zod";
import type { Audience, NormalizedEvent } from "../../types/event.js";
import type { HttpClient } from "../http.js";
import {
  DAYS_AHEAD,
  MAX_DESCRIPTION_LENGTH,
  SOURCE_TIME_ZONE,
  cleanInlineText,
  htmlToText,
  logSkip,
  resolveEndTime,
  validateNormalized,
} from "../normalize.js";
import { SourceFetchError, type RawEvent, type SourceAdapter } from "./types.js";

export interface IcalFeed {
  // Short slug; the source name becomes "ical:<id>".
  id: string;
  // Host shown on event cards.
  name: string;
  // The feed itself (https).
  url: string;
  // Public page for the calendar, used when an event carries no link of its own.
  homepage: string;
  // Audience for every event in the feed, e.g. "rsvp" for Luma, where signing up is the norm.
  audience?: Exclude<Audience, "restricted">;
}

export const icalSourceName = (feed: IcalFeed): string => `ical:${feed.id}`;

// One occurrence, as fetch() hands it to normalize().
const icalRawSchema = z.object({
  uid: z.string(),
  occurrenceKey: z.string().min(1),
  allDay: z.boolean(),
  // ISO instant for timed events; YYYY-MM-DD (exclusive end) for all-day ones.
  start: z.string(),
  end: z.string().nullable(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  url: z.string().nullable(),
  status: z.string().nullable(),
  classification: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
type IcalRaw = z.infer<typeof icalRawSchema>;

const textOf = (value: ParameterValue | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const text = typeof value === "string" ? value : value.val;
  return typeof text === "string" && text.trim() ? text : null;
};

const pad = (value: number): string => String(value).padStart(2, "0");

// node-ical builds date-only values at local midnight, so local getters give the calendar date.
const localDateKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const isKnownZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

// node-ical tags times that carry a zone (TZID or a trailing Z) with `tz`. Floating
// times and unknown TZIDs are built on the runner's own clock (UTC in GitHub
// Actions); they mean campus wall-clock time, so read them that way.
const toInstant = (date: Date): Date => {
  const zone = (date as Date & { tz?: unknown }).tz;
  if (typeof zone === "string" && isKnownZone(zone)) return date;
  const wallClock = `${localDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return fromZonedTime(wallClock, SOURCE_TIME_ZONE);
};

const isVEvent = (component: unknown): component is VEvent =>
  typeof component === "object" && component !== null && (component as { type?: unknown }).type === "VEVENT";

const geoOf = (event: VEvent): { lat: number | null; lng: number | null } => {
  const geo = (event as { geo?: { lat?: unknown; lon?: unknown } }).geo;
  const lat = typeof geo?.lat === "number" && Number.isFinite(geo.lat) ? geo.lat : null;
  const lng = typeof geo?.lon === "number" && Number.isFinite(geo.lon) ? geo.lon : null;
  return { lat, lng };
};

const toRaw = (instance: EventInstance): IcalRaw => {
  const event = instance.event;
  const allDay = instance.isFullDay;
  // Overrides keep the id of the occurrence they replace, so moving an event
  // doesn't make it look like a new one (firstSeenAt survives). All-day keys use
  // the calendar date, so they don't depend on the runner's time zone.
  const originalStart = event.recurrenceid ?? instance.start;
  const occurrence = allDay ? localDateKey(originalStart) : toInstant(originalStart).toISOString();
  const occurrenceKey = instance.isRecurring || event.recurrenceid ? `${event.uid}@${occurrence}` : event.uid;
  return {
    uid: event.uid,
    occurrenceKey,
    allDay,
    start: allDay ? localDateKey(instance.start) : toInstant(instance.start).toISOString(),
    end: instance.end ? (allDay ? localDateKey(instance.end) : toInstant(instance.end).toISOString()) : null,
    summary: textOf(instance.summary) ?? textOf(event.summary),
    description: textOf(event.description),
    location: textOf(event.location as ParameterValue | undefined),
    url: typeof event.url === "string" && event.url.trim() ? event.url.trim() : null,
    status: typeof event.status === "string" ? event.status : null,
    classification: typeof event.class === "string" ? event.class : null,
    ...geoOf(event),
  };
};

// Parses a feed body into raw entries for the window [from, to].
export const parseIcalFeed = (body: string, window: { from: Date; to: Date }): IcalRaw[] => {
  const parsed = ical.sync.parseICS(body);
  const events = Object.values(parsed).filter(isVEvent);
  const seriesUids = new Set(events.filter((event) => !event.recurrenceid).map((event) => event.uid));
  const out: IcalRaw[] = [];
  for (const component of events) {
    // node-ical folds RECURRENCE-ID overrides into their series. An override
    // whose series isn't in the feed stands alone.
    if (component.recurrenceid && seriesUids.has(component.uid)) continue;
    for (const instance of ical.expandRecurringEvent(component, { ...window, expandOngoing: true })) {
      out.push(toRaw(instance));
    }
  }
  return out;
};

export const fetchWindowFor = (now: Date): { from: Date; to: Date } => ({
  from: subDays(now, 1),
  to: addDays(now, DAYS_AHEAD + 1),
});

// Luma descriptions open with "Get up-to-date information at: <event link>".
const LUMA_LINK_LINE = /^Get up-to-date information at:\s*(https:\/\/\S+)\s*/i;
const URL_IN_TEXT = /https?:\/\/\S+/gi;
// What's left of a location once links are removed, when the event is online only.
const ONLINE_ONLY_WORDS = /^(?:zoom|online|virtual|webinar|google meet|microsoft teams|teams|webex|link)?$/i;
const HIDDEN_CLASSES = new Set(["PRIVATE", "CONFIDENTIAL"]);
const CANCELLED_TITLE = /^\W*(?:cancel{1,2}ed|postponed)\b/i;

// iCal text is plain, so "<3" or "a < b" must survive. Some calendars (Google)
// put HTML in descriptions anyway; only those go through the HTML parser.
const LOOKS_LIKE_HTML = /<\/?[a-z][^>]*>|&(?:[a-z]+|#\d+);/i;

const plainText = (value: string): string =>
  value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);

const descriptionText = (value: string): string => (LOOKS_LIKE_HTML.test(value) ? htmlToText(value) : plainText(value));

const titleText = (value: string | null): string =>
  value && !LOOKS_LIKE_HTML.test(value) ? value.replace(/\s+/g, " ").trim() : cleanInlineText(value);

// Online-only when the location is just a link or a word like "Zoom". A room plus
// a Zoom link is a hybrid event, which can still serve food.
const onlineOnly = (location: string): boolean =>
  ONLINE_ONLY_WORDS.test(location.replace(URL_IN_TEXT, " ").replace(/[\s,;:|/()-]+/g, " ").trim());

const campusMidnight = (dateKey: string): Date => fromZonedTime(`${dateKey}T00:00:00`, SOURCE_TIME_ZONE);

export const normalizeIcalEvent = (feed: IcalFeed, raw: RawEvent): NormalizedEvent | null => {
  const source = icalSourceName(feed);
  const parsed = icalRawSchema.safeParse(raw);
  if (!parsed.success) {
    logSkip(source, "unknown", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return null;
  }
  const item = parsed.data;
  const rawId = item.occurrenceKey;
  if (item.classification && HIDDEN_CLASSES.has(item.classification.toUpperCase())) {
    logSkip(source, rawId, "private event");
    return null;
  }
  if (item.status?.toUpperCase() === "CANCELLED" || CANCELLED_TITLE.test(item.summary ?? "")) {
    logSkip(source, rawId, "cancelled or postponed");
    return null;
  }

  let startTime: Date;
  let listedEnd: Date | null;
  if (item.allDay) {
    startTime = campusMidnight(item.start);
    // All-day DTEND is exclusive: the event runs until 23:59 the day before.
    listedEnd = item.end ? subMinutes(campusMidnight(item.end), 1) : null;
  } else {
    startTime = new Date(item.start);
    listedEnd = item.end ? new Date(item.end) : null;
  }
  if (Number.isNaN(startTime.getTime())) {
    logSkip(source, rawId, `unparseable start time "${item.start}"`);
    return null;
  }

  let description = item.description ?? "";
  const lumaLink = description.match(LUMA_LINK_LINE)?.[1] ?? null;
  if (lumaLink) description = description.replace(LUMA_LINK_LINE, "");

  const location = item.location ? titleText(item.location) || null : null;
  const isVirtual = location !== null && onlineOnly(location);
  // Hybrid events show the room, not the meeting link.
  const place = location?.replace(URL_IN_TEXT, " ").replace(/\s+/g, " ").replace(/^[\s,;:|/-]+|[\s,;:|/-]+$/g, "");

  return validateNormalized(source, rawId, {
    source,
    sourceEventId: item.occurrenceKey,
    sourceUrl: item.url ?? lumaLink ?? feed.homepage,
    title: titleText(item.summary),
    description: descriptionText(description),
    startTime,
    endTime: resolveEndTime(startTime, listedEnd, item.allDay),
    allDay: item.allDay,
    locationName: isVirtual || !place ? null : place,
    lat: item.lat,
    lng: item.lng,
    hostOrg: feed.name,
    audience: feed.audience ?? "unknown",
    audienceNote: null,
    cost: null,
    isVirtual,
  } satisfies NormalizedEvent);
};

export interface IcalAdapterOptions {
  http: HttpClient;
  feed: IcalFeed;
  now?: () => Date;
}

export const createIcalAdapter = ({ http, feed, now = () => new Date() }: IcalAdapterOptions): SourceAdapter => ({
  name: icalSourceName(feed),
  allowEmpty: true,

  async fetch(): Promise<RawEvent[]> {
    const response = await http.getText(feed.url, { accept: "text/calendar" });
    if (!response.body.includes("BEGIN:VCALENDAR")) {
      throw new SourceFetchError(`${feed.url} did not return an iCalendar feed`, response.body);
    }
    try {
      return parseIcalFeed(response.body, fetchWindowFor(now()));
    } catch (error) {
      throw new SourceFetchError(`Could not parse ${feed.url}`, response.body, { cause: error });
    }
  },

  normalize: (raw) => normalizeIcalEvent(feed, raw),
});
