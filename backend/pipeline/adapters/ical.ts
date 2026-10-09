// Source type: public iCalendar (.ics) subscription feeds, such as Luma calendars
// ("Add iCal Subscription", offered to signed-out visitors) and sites' "Subscribe"
// links. A published calendar feed is third in our preference order, after an
// official API and a discovered JSON endpoint, and needs no page scraping. (Not
// Google Calendar: calendar.google.com/robots.txt disallows its public .ics feeds.)
//
// Each feed is its own adapter (source "ical:<feed id>"), so one broken feed can't
// hide the others and keeps its previously published events when it fails.
// Feeds are listed in icalFeeds.ts along with how each was found and verified.
//
// Verified against real feeds on 2026-09-30 (see fixtures/luma-*.ics):
// - Luma feeds give UTC times, STATUS:TENTATIVE on everything, GEO coordinates,
//   and a DESCRIPTION that is only the event link, address, and host. The event's
//   own write-up is on its page as schema.org JSON-LD (checked 2026-10-08, see
//   fixtures/luma-event-page.html), so for Luma feeds we also read the pages of
//   upcoming events: one request each, at most LUMA_PAGE_LIMIT per feed per run.
// - node-ical expands RRULEs across DST correctly, applies EXDATE and
//   RECURRENCE-ID overrides, and represents all-day dates as local midnight
//   (read them with local getters). See fixtures/ical-edge-cases.ics.

import { addDays, subDays, subMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import ical, { type EventInstance, type ParameterValue, type VEvent } from "node-ical";
import { z } from "zod";
import type { Audience, NormalizedEvent } from "../../types/event.js";
import type { HttpClient } from "../http.js";
import { findJsonLdEvent } from "../jsonLd.js";
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
import { restrictionInText } from "../restrictions.js";
import { SourceFetchError, type RawEvent, type SourceAdapter } from "./types.js";

// A feed's own wording for who an event is for, e.g. a line every description
// ends with. A matching restricted rule wins, then any limit in the text itself
// (restrictions.ts), then the first other rule that matches.
export interface AudienceRule {
  pattern: RegExp;
  audience: Audience;
  note: string | null;
}

export interface IcalFeed {
  // Short slug; the source name becomes "ical:<id>".
  id: string;
  // Host shown on event cards.
  name: string;
  // The feed itself (https).
  url: string;
  // Public page for the calendar, used when an event carries no link of its own.
  homepage: string;
  // Audience for every event in the feed, e.g. "rsvp" for Luma, where signing up is
  // the norm. Restrictions in an event's own text still apply.
  audience?: Exclude<Audience, "restricted">;
  audienceRules?: AudienceRule[];
  // "luma": read each upcoming event's page for its description and price.
  eventPages?: "luma";
  // Retries after a failed request (default: the HTTP client's). 0 for hosts that
  // ask for a long crawl delay.
  retries?: number;
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
  // From the event's own page, when it's read (see eventPages).
  pageDescription: z.string().nullable().optional(),
  pageCost: z.string().nullable().optional(),
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

// Luma event pages are read for events starting within LUMA_PAGE_DAYS, at most
// LUMA_PAGE_LIMIT pages per feed per run. Later events are read as they come closer.
const LUMA_PAGE_DAYS = 60;
export const LUMA_PAGE_LIMIT = 40;
const LUMA_EVENT_PAGE = /^https:\/\/(?:luma\.com|lu\.ma)\/[\w-]+$/;

const lumaPageOf = (entry: IcalRaw): string | null => {
  const link = entry.description?.match(LUMA_LINK_LINE)?.[1] ?? entry.url;
  return link && LUMA_EVENT_PAGE.test(link) ? link : null;
};

// "Free" when every ticket is free, a price when none is, otherwise unknown.
export const costFromOffers = (offers: unknown): string | null => {
  const list = Array.isArray(offers) ? offers : [offers];
  const prices = list
    .map((offer) => (typeof offer === "object" && offer !== null ? Number((offer as { price?: unknown }).price) : NaN))
    .filter(Number.isFinite);
  if (prices.length === 0) return null;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  if (high === 0) return "Free";
  if (low === 0) return null;
  return low === high ? `$${low}` : `$${low}–$${high}`;
};

// The description and price on a Luma event page, from its schema.org JSON-LD.
export const readLumaPage = (html: string): { description: string | null; cost: string | null } => {
  const event = findJsonLdEvent(html);
  const description = typeof event?.description === "string" && event.description.trim() ? event.description : null;
  return { description, cost: event ? costFromOffers(event.offers) : null };
};

// Adds each upcoming event's page description and price to its entries (a
// recurring event's occurrences share one page). A page that fails is skipped:
// the event keeps what the feed says.
const addLumaPages = async (http: HttpClient, feed: IcalFeed, entries: IcalRaw[], now: Date): Promise<void> => {
  const horizon = addDays(now, LUMA_PAGE_DAYS);
  const pages = new Map<string, IcalRaw[]>();
  for (const entry of [...entries].sort((a, b) => a.start.localeCompare(b.start))) {
    const page = lumaPageOf(entry);
    if (!page || new Date(entry.start) > horizon) continue;
    if (!pages.has(page) && pages.size >= LUMA_PAGE_LIMIT) continue;
    pages.set(page, [...(pages.get(page) ?? []), entry]);
  }
  for (const [page, pageEntries] of pages) {
    try {
      const { description, cost } = readLumaPage((await http.getText(page, { accept: "text/html" })).body);
      for (const entry of pageEntries) Object.assign(entry, { pageDescription: description, pageCost: cost });
    } catch (error) {
      console.warn(`[${icalSourceName(feed)}] couldn't read ${page}: ${error instanceof Error ? error.message : error}`);
    }
  }
};
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

// Some calendars write the venue as "@ Venue, street, ..., United States".
const tidyLocation = (location: string): string => location.replace(/^@\s*/, "").replace(/,\s*United States$/i, "");

// A limit anywhere in the text outranks a feed's broader line: "Lunch provided.
// Open to all SLS students." above "This event is open to the Stanford community."
const audienceFor = (feed: IcalFeed, text: string): { audience: Audience; audienceNote: string | null } => {
  const matching = (feed.audienceRules ?? []).filter(({ pattern }) => pattern.test(text));
  const restrictedRule = matching.find((rule) => rule.audience === "restricted");
  if (restrictedRule) return { audience: "restricted", audienceNote: restrictedRule.note };
  const restriction = restrictionInText(text);
  if (restriction) return { audience: "restricted", audienceNote: restriction };
  const rule = matching[0];
  if (rule) return { audience: rule.audience, audienceNote: rule.note };
  return { audience: feed.audience ?? "unknown", audienceNote: null };
};

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
  // The page's own write-up, when it was read, says more than the feed.
  if (item.pageDescription) description = item.pageDescription;

  const title = titleText(item.summary);
  const text = descriptionText(description);
  const { audience, audienceNote } = audienceFor(feed, `${title}\n${text}`);
  const location = item.location ? tidyLocation(titleText(item.location)) || null : null;
  const isVirtual = location !== null && onlineOnly(location);
  // Hybrid events show the room, not the meeting link.
  const place = location?.replace(URL_IN_TEXT, " ").replace(/\s+/g, " ").replace(/^[\s,;:|/-]+|[\s,;:|/-]+$/g, "");

  return validateNormalized(source, rawId, {
    source,
    sourceEventId: item.occurrenceKey,
    sourceUrl: item.url ?? lumaLink ?? feed.homepage,
    title,
    description: text,
    startTime,
    endTime: resolveEndTime(startTime, listedEnd, item.allDay),
    allDay: item.allDay,
    locationName: isVirtual || !place ? null : place,
    lat: item.lat,
    lng: item.lng,
    hostOrg: feed.name,
    audience,
    audienceNote,
    cost: item.pageCost ?? null,
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
    const response = await http.getText(feed.url, { accept: "text/calendar", retries: feed.retries });
    if (!response.body.includes("BEGIN:VCALENDAR")) {
      throw new SourceFetchError(`${feed.url} did not return an iCalendar feed`, response.body);
    }
    let entries: IcalRaw[];
    try {
      entries = parseIcalFeed(response.body, fetchWindowFor(now()));
    } catch (error) {
      throw new SourceFetchError(`Could not parse ${feed.url}`, response.body, { cause: error });
    }
    if (feed.eventPages === "luma") await addLumaPages(http, feed, entries, now());
    return entries;
  },

  normalize: (raw) => normalizeIcalEvent(feed, raw),
});
