// Source: departments' own websites on Stanford Sites, the university's Drupal
// platform (e.g. icme.stanford.edu, glo.stanford.edu).
//
// Access method: the platform's public JSON:API (`/jsonapi/node/stanford_event`),
// a discovered JSON endpoint (second in our preference order), confirmed with the
// user on 2026-10-08. The sites' RSS feeds (`/events/rss`) carry only titles and
// times. robots.txt on each site (checked 2026-10-08) allows /jsonapi/ for all
// crawlers and asks for Crawl-delay: 30, so each run makes one request per site
// (its next PAGE_LIMIT events) and doesn't retry: a failure waits for the next run.
//
// Verified against icme.stanford.edu on 2026-10-08 (see fixtures/stanford-sites-icme.json):
// - Events copied in from Stanford Events carry su_event_localist_id or
//   su_event_source. Those are skipped here, since Stanford Events is read directly.
// - su_event_date_time is a Smart Date: ISO `value` / `end_value`, in UTC. All-day
//   events run from campus midnight to 23:59. A weekly series is often entered as
//   one span over its whole run (a Sep 30 – Nov 18 "Storytime"), with the real
//   times only in the text; spans over MAX_SPAN_DAYS are skipped for that reason.
// - Audience is a taxonomy (Students, Faculty/Staff, Alumni, ...), included in the
//   response. The request asks only for the fields used here, so the organizer's
//   email and phone (su_event_email, su_event_telephone) are never fetched.

import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import type { Audience, NormalizedEvent } from "../../types/event.js";
import type { HttpClient } from "../http.js";
import {
  SOURCE_TIME_ZONE,
  cleanInlineText,
  htmlToText,
  logSkip,
  parseSourceTime,
  resolveEndTime,
  validateNormalized,
} from "../normalize.js";
import { restrictionInText } from "../restrictions.js";
import { SourceFetchError, type RawEvent, type SourceAdapter } from "./types.js";

export interface StanfordSite {
  // Short slug; the source name becomes "site:<id>".
  id: string;
  // Host shown on event cards.
  name: string;
  host: string;
}

// Sites whose own events (not copies from Stanford Events) included free food when
// checked on 2026-10-08. Each site's robots.txt was checked the same day.
export const STANFORD_SITES: StanfordSite[] = [
  { id: "icme", name: "Institute for Computational & Mathematical Engineering", host: "icme.stanford.edu" },
  { id: "bosp", name: "Bing Overseas Studies Program", host: "bosp.stanford.edu" },
  { id: "glo", name: "Graduate Life Office", host: "glo.stanford.edu" },
  { id: "aeroastro", name: "Aeronautics & Astronautics", host: "aa.stanford.edu" },
  { id: "cs", name: "Computer Science", host: "www.cs.stanford.edu" },
  { id: "ctl", name: "Center for Teaching and Learning", host: "ctl.stanford.edu" },
  { id: "chemh", name: "Sarafan ChEM-H", host: "chemh.stanford.edu" },
];

export const siteSourceName = (site: StanfordSite): string => `site:${site.id}`;

const PAGE_LIMIT = 50;
const MAX_SPAN_DAYS = 7;
const MAX_SPAN_MS = MAX_SPAN_DAYS * 24 * 60 * 60 * 1000;
const FIELDS = [
  "title",
  "path",
  "body",
  "su_event_date_time",
  "su_event_dek",
  "su_event_subheadline",
  "su_event_alt_loc",
  "su_event_location",
  "su_event_localist_id",
  "su_event_source",
  "su_event_cta",
  "su_event_audience",
];

// Upcoming published events (ending at or after `from`), soonest first, with the
// audience terms included.
export const eventsUrl = (site: StanfordSite, from: Date): string => {
  const params = new URLSearchParams({
    "filter[status]": "1",
    "filter[upcoming][condition][path]": "su_event_date_time.end_value",
    "filter[upcoming][condition][operator]": ">=",
    "filter[upcoming][condition][value]": String(Math.floor(from.getTime() / 1000)),
    sort: "su_event_date_time.value",
    "page[limit]": String(PAGE_LIMIT),
    include: "su_event_audience",
    "fields[node--stanford_event]": FIELDS.join(","),
    "fields[taxonomy_term--event_audience]": "name",
  });
  return `https://${site.host}/jsonapi/node/stanford_event?${params}`;
};

// The day containing `now`, as of campus midnight: the URL stays the same all day,
// so a rerun can use the cached response.
const startOfCampusDay = (now: Date): Date =>
  parseSourceTime(formatInTimeZone(now, SOURCE_TIME_ZONE, "yyyy-MM-dd")) ?? now;

const smartDateSchema = z.object({ value: z.string(), end_value: z.string().nullish() });

const linkSchema = z.object({ uri: z.string().nullish(), url: z.string().nullish(), title: z.string().nullish() });

const addressSchema = z.object({
  organization: z.string().nullish(),
  address_line1: z.string().nullish(),
  locality: z.string().nullish(),
});

const responseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      attributes: z.record(z.string(), z.unknown()),
      relationships: z
        .object({
          su_event_audience: z.object({ data: z.array(z.object({ id: z.string() })).nullish() }).nullish(),
        })
        .nullish(),
    }),
  ),
  included: z
    .array(z.object({ id: z.string(), type: z.string(), attributes: z.object({ name: z.string().nullish() }).nullish() }))
    .nullish(),
});

// One event, as fetch() hands it to normalize(): the node's attributes plus the
// names of its audience terms.
const rawSchema = z.object({
  id: z.string(),
  audiences: z.array(z.string()),
  attributes: z.object({
    title: z.string(),
    path: z.object({ alias: z.string().nullish() }).nullish(),
    body: z.union([z.string(), z.object({ value: z.string().nullish() })]).nullish(),
    su_event_date_time: smartDateSchema,
    su_event_dek: z.string().nullish(),
    su_event_subheadline: z.string().nullish(),
    su_event_alt_loc: z.string().nullish(),
    su_event_location: addressSchema.nullish(),
    su_event_localist_id: z.unknown(),
    su_event_source: z.unknown(),
    su_event_cta: linkSchema.nullish(),
  }),
});
type SiteRaw = z.infer<typeof rawSchema>;

// The events in one JSON:API response, with audience names resolved.
export const parseSiteResponse = (body: unknown): RawEvent[] => {
  const response = responseSchema.parse(body);
  const terms = new Map(
    (response.included ?? [])
      .filter((item) => item.type === "taxonomy_term--event_audience" && item.attributes?.name)
      .map((item) => [item.id, item.attributes?.name ?? ""]),
  );
  return response.data.map((node) => ({
    id: node.id,
    attributes: node.attributes,
    audiences: (node.relationships?.su_event_audience?.data ?? []).flatMap((term) => terms.get(term.id) ?? []),
  }));
};

const OPEN_AUDIENCES = /^(?:general public|public|everyone|all)$/i;
const RSVP_WORDS = /\brsvp\b|\bregist(?:er|ration)\b|\bsign[- ]?up\b|\btickets?\b/i;
const ONLINE_ONLY = /^(?:zoom|online|virtual|webinar)$/i;

const bodyHtml = (body: SiteRaw["attributes"]["body"]): string =>
  typeof body === "string" ? body : (body?.value ?? "");

const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || value === "" || (typeof value === "object" && Object.keys(value).length === 0);

const locationOf = (attributes: SiteRaw["attributes"]): string | null => {
  const alt = cleanInlineText(attributes.su_event_alt_loc);
  if (alt) return alt;
  const address = attributes.su_event_location;
  const parts = [address?.organization, address?.address_line1, address?.locality].map(cleanInlineText).filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
};

// Smart Date's all-day events run from campus midnight to 23:59.
const isAllDay = (start: Date, end: Date | null): boolean =>
  formatInTimeZone(start, SOURCE_TIME_ZONE, "HH:mm") === "00:00" &&
  end !== null &&
  formatInTimeZone(end, SOURCE_TIME_ZONE, "HH:mm") === "23:59";

const audienceOf = (item: SiteRaw, text: string): { audience: Audience; audienceNote: string | null } => {
  const restriction = restrictionInText(text);
  if (restriction) return { audience: "restricted", audienceNote: restriction };
  const isOpen = item.audiences.some((name) => OPEN_AUDIENCES.test(name.trim()));
  const audienceNote = !isOpen && item.audiences.length > 0 ? item.audiences.join(", ") : null;
  if (RSVP_WORDS.test(item.attributes.su_event_cta?.title ?? "")) return { audience: "rsvp", audienceNote };
  return { audience: isOpen ? "open" : "unknown", audienceNote };
};

export const normalizeSiteEvent = (site: StanfordSite, raw: RawEvent): NormalizedEvent | null => {
  const source = siteSourceName(site);
  const parsed = rawSchema.safeParse(raw);
  if (!parsed.success) {
    logSkip(source, "unknown", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return null;
  }
  const item = parsed.data;
  const { attributes } = item;
  if (!isEmpty(attributes.su_event_localist_id) || !isEmpty(attributes.su_event_source)) {
    logSkip(source, item.id, "copied from Stanford Events");
    return null;
  }

  const startTime = parseSourceTime(attributes.su_event_date_time.value);
  if (!startTime) {
    logSkip(source, item.id, `unparseable start time "${attributes.su_event_date_time.value}"`);
    return null;
  }
  const listedEnd = parseSourceTime(attributes.su_event_date_time.end_value);
  if (listedEnd && listedEnd.getTime() - startTime.getTime() > MAX_SPAN_MS) {
    logSkip(source, item.id, `spans more than ${MAX_SPAN_DAYS} days, likely a series without its dates`);
    return null;
  }
  const allDay = isAllDay(startTime, listedEnd);

  const title = cleanInlineText(attributes.title);
  // The dek and subheadline often carry the hook ("Lunch & Learn").
  const description = [cleanInlineText(attributes.su_event_dek), cleanInlineText(attributes.su_event_subheadline), htmlToText(bodyHtml(attributes.body))]
    .filter(Boolean)
    .join("\n\n");
  const location = locationOf(attributes);
  const isVirtual = location !== null && ONLINE_ONLY.test(location);
  const { audience, audienceNote } = audienceOf(item, `${title}\n${description}`);
  const alias = attributes.path?.alias;

  return validateNormalized(source, item.id, {
    source,
    sourceEventId: item.id,
    sourceUrl: alias ? `https://${site.host}${alias}` : `https://${site.host}/node/${item.id}`,
    title,
    description,
    startTime,
    endTime: resolveEndTime(startTime, listedEnd, allDay),
    allDay,
    locationName: isVirtual ? null : location,
    lat: null,
    lng: null,
    hostOrg: site.name,
    audience,
    audienceNote,
    cost: null,
    isVirtual,
  } satisfies NormalizedEvent);
};

export interface StanfordSiteAdapterOptions {
  http: HttpClient;
  site: StanfordSite;
  now?: () => Date;
}

export const createStanfordSiteAdapter = ({ http, site, now = () => new Date() }: StanfordSiteAdapterOptions): SourceAdapter => ({
  name: siteSourceName(site),
  // A department can go weeks without events of its own.
  allowEmpty: true,

  async fetch(): Promise<RawEvent[]> {
    const url = eventsUrl(site, startOfCampusDay(now()));
    const response = await http.getText(url, { accept: "application/vnd.api+json", retries: 0 });
    let body: unknown;
    try {
      body = JSON.parse(response.body);
    } catch (error) {
      throw new SourceFetchError(`${url} did not return JSON`, response.body, { cause: error });
    }
    try {
      return parseSiteResponse(body);
    } catch (error) {
      throw new SourceFetchError(`${url} returned an unexpected shape`, response.body, { cause: error });
    }
  },

  normalize: (raw) => normalizeSiteEvent(site, raw),
});
