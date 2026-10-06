// Source: CardinalEngage (cardinalengage.stanford.edu), Stanford's CampusGroups site
// for student organizations.
//
// Access method: the site's public events RSS feed (`/rss_events`), third in our
// preference order (iCal/RSS). The site's event pages and API need a Stanford
// login, and robots.txt (checked 2026-10-06) disallows `/mobile_ws/v17/` and
// `/v18/`, the mobile app backend. We use neither. The RSS feed needs no login and
// isn't disallowed.
//
// Verified against the live feed on 2026-10-06 (see fixtures/cardinalengage-rss.xml):
// - Only events clubs chose to publish publicly appear (24 that day, mostly GSB
//   clubs), not the whole calendar.
// - Fields are plain child elements of <item>: eventId, group (the club),
//   eventStartDateTime / eventEndDateTime as ISO with offset (7 fractional digits),
//   allDayEvent, title, fullDescription (entity-escaped text), eventLink,
//   eventExternalRegistrationLink, locationType, eventLocation, approvalStatus,
//   eventDelete, foodProvided (0/1, the host's checkbox), privacyLevel.
// - privacyLevel is 0 for public events; other values (6, 13) limit who can see the
//   event to members, so those are treated as restricted.
// - eventLocation reads "Private Location (sign in to display)" for signed-out
//   visitors. We never try to recover the hidden room.

import * as cheerio from "cheerio";
import { addDays } from "date-fns";
import { z } from "zod";
import type { Audience, NormalizedEvent } from "../../types/event.js";
import type { HttpClient } from "../http.js";
import {
  DAYS_AHEAD,
  cleanInlineText,
  htmlToText,
  logSkip,
  parseSourceTime,
  resolveEndTime,
  validateNormalized,
} from "../normalize.js";
import { restrictionInText } from "../restrictions.js";
import { SourceFetchError, type RawEvent, type SourceAdapter } from "./types.js";

export const CARDINALENGAGE_SOURCE = "cardinalengage";
export const CARDINALENGAGE_RSS_URL = "https://cardinalengage.stanford.edu/rss_events";

// One <item>, as fetch() hands it to normalize().
const itemSchema = z.object({
  eventId: z.string().min(1),
  group: z.string(),
  title: z.string(),
  fullDescription: z.string(),
  description: z.string(),
  eventStartDateTime: z.string(),
  eventEndDateTime: z.string(),
  allDayEvent: z.string(),
  eventLink: z.string(),
  eventExternalRegistrationLink: z.string(),
  eventLocation: z.string(),
  locationType: z.string(),
  approvalStatus: z.string(),
  eventDelete: z.string(),
  foodProvided: z.string(),
  privacyLevel: z.string(),
});
type Item = z.infer<typeof itemSchema>;

const FIELDS = Object.keys(itemSchema.shape);

// Each <item> as an object of the fields we use, read as text (entities decoded).
// Missing elements become "", so the schema check in normalize() sees every key.
export const parseRssFeed = (body: string): Record<string, string>[] => {
  const $ = cheerio.load(body, { xml: true });
  return $("channel > item")
    .toArray()
    .map((item) => Object.fromEntries(FIELDS.map((field) => [field, $(item).children(field).first().text().trim()])));
};

// What signed-out visitors see instead of the room.
const HIDDEN_LOCATION = /^-?$|private location|sign in to|register to display/i;
const ONLINE = /^(?:virtual|online)$/i;
const RSVP_IN_TEXT = /\brsvp\b|\bregist(?:er|ration)\b|\bsign[- ]?up\b|\btickets?\b/i;

const audienceOf = (item: Item, text: string): { audience: Audience; audienceNote: string | null } => {
  if (item.privacyLevel !== "0") return { audience: "restricted", audienceNote: "Members only (CardinalEngage)" };
  const restriction = restrictionInText(text);
  if (restriction) return { audience: "restricted", audienceNote: restriction };
  // CardinalEngage events are RSVP pages; say so when the host asks for one.
  const rsvp = item.eventExternalRegistrationLink !== "" || RSVP_IN_TEXT.test(text);
  return { audience: rsvp ? "rsvp" : "unknown", audienceNote: null };
};

export const normalizeCardinalEngageEvent = (raw: RawEvent): NormalizedEvent | null => {
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    logSkip(CARDINALENGAGE_SOURCE, "unknown", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return null;
  }
  const item = parsed.data;
  const rawId = item.eventId;
  if (item.eventDelete !== "0" || item.approvalStatus !== "1") {
    logSkip(CARDINALENGAGE_SOURCE, rawId, "deleted or not approved");
    return null;
  }

  const startTime = parseSourceTime(item.eventStartDateTime);
  if (!startTime) {
    logSkip(CARDINALENGAGE_SOURCE, rawId, `unparseable start time "${item.eventStartDateTime}"`);
    return null;
  }
  const allDay = item.allDayEvent === "1";
  const title = cleanInlineText(item.title);
  const description = htmlToText(item.fullDescription || item.description);
  const location = cleanInlineText(item.eventLocation);
  const { audience, audienceNote } = audienceOf(item, `${title}\n${description}`);

  return validateNormalized(CARDINALENGAGE_SOURCE, rawId, {
    source: CARDINALENGAGE_SOURCE,
    sourceEventId: item.eventId,
    sourceUrl: item.eventLink,
    title,
    description,
    startTime,
    endTime: resolveEndTime(startTime, parseSourceTime(item.eventEndDateTime), allDay),
    allDay,
    locationName: HIDDEN_LOCATION.test(location) ? null : location,
    lat: null,
    lng: null,
    hostOrg: cleanInlineText(item.group) || null,
    audience,
    audienceNote,
    cost: null,
    isVirtual: ONLINE.test(item.locationType),
    foodProvided: item.foodProvided === "1",
  } satisfies NormalizedEvent);
};

export interface CardinalEngageAdapterOptions {
  http: HttpClient;
  url?: string;
  now?: () => Date;
}

export const createCardinalEngageAdapter = ({
  http,
  url = CARDINALENGAGE_RSS_URL,
  now = () => new Date(),
}: CardinalEngageAdapterOptions): SourceAdapter => ({
  name: CARDINALENGAGE_SOURCE,
  // Clubs publish few events publicly; an empty feed is plausible.
  allowEmpty: true,

  async fetch(): Promise<RawEvent[]> {
    const response = await http.getText(url, { accept: "application/rss+xml, text/xml" });
    if (!/<rss[\s>]/.test(response.body)) {
      throw new SourceFetchError(`${url} did not return an RSS feed`, response.body);
    }
    // The feed is small and unpaged; keep the same 8-week horizon as other sources.
    const horizon = addDays(now(), DAYS_AHEAD + 1);
    return parseRssFeed(response.body).filter((item) => {
      const start = parseSourceTime(item.eventStartDateTime);
      return start === null || start <= horizon;
    });
  },

  normalize: normalizeCardinalEngageEvent,
});
