// Source: Stanford Events (events.stanford.edu), which runs on Localist.
//
// Access method: the official public Localist JSON API (`/api/2/events`), the
// top option in our preference order. No login is involved. robots.txt
// (checked 2026-09-28) does not disallow /api/ and sets `Crawl-Delay: 1`,
// which our 1 req/s per-host limit already satisfies.
//
// Verified against live responses on 2026-09-28 (see fixtures/):
// - Pagination: `page` + `pp`. The server caps `pp` at 100. The response has
//   `page: { current, size, total (page count), total_items, next_page }`.
// - Date window: `start` and `end` as YYYY-MM-DD in campus time; `end` is exclusive.
// - Each list entry is a single occurrence: `event_instances` has exactly one
//   element, so recurring events appear once per date. We key on the instance id.
// - Instance times carry an explicit offset, e.g. "2026-09-28T00:00:00-07:00".
// - Audience signals: `private`, `custom_fields.restricted_to` (free text such as
//   "Current Stanford students and postdocs"), `filters.event_audience`
//   (e.g. "Everyone", "Students"), `ticket_url`, `ticket_cost`, `has_register`.
// - Titles can contain HTML entities ("&amp;"); `description` is HTML.

import { addDays, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import type { Audience, NormalizedEvent } from "../../types/event.js";
import type { HttpClient } from "../http.js";
import {
  SOURCE_TIME_ZONE,
  cleanInlineText,
  htmlToText,
  logSkip,
  nullIfEmpty,
  parseCoordinate,
  parseSourceTime,
  resolveEndTime,
  validateNormalized,
} from "../normalize.js";
import { SourceFetchError, type RawEvent, type SourceAdapter } from "./types.js";

export const LOCALIST_SOURCE = "localist";
export const LOCALIST_BASE_URL = "https://events.stanford.edu";
const PAGE_SIZE = 100;
// About 3x the ~15 pages an 8-week window currently needs. Exceeding it fails the
// run loudly instead of silently storing a partial (and misleading) snapshot.
export const MAX_PAGES = 40;
export const DAYS_AHEAD = 56;

const OPEN_AUDIENCE_GROUPS = new Set(["everyone", "general public"]);

const namedItem = z.object({ name: z.string() });

const pageEnvelopeSchema = z.object({
  events: z.array(z.unknown()),
  page: z.object({
    current: z.number(),
    total: z.number(),
    next_page: z.number().nullish(),
  }),
});

const localistEventSchema = z.object({
  event: z.object({
    id: z.number(),
    title: z.string(),
    description: z.string().nullish(),
    description_text: z.string().nullish(),
    status: z.string().nullish(),
    private: z.boolean().nullish(),
    experience: z.string().nullish(),
    location: z.string().nullish(),
    location_name: z.string().nullish(),
    room_number: z.string().nullish(),
    address: z.string().nullish(),
    ticket_url: z.string().nullish(),
    ticket_cost: z.string().nullish(),
    has_register: z.boolean().nullish(),
    free: z.boolean().nullish(),
    localist_url: z.string(),
    geo: z
      .object({
        latitude: z.union([z.string(), z.number()]).nullish(),
        longitude: z.union([z.string(), z.number()]).nullish(),
      })
      .nullish()
      .catch(null),
    departments: z.array(namedItem).nullish().catch(null),
    filters: z
      .object({ event_audience: z.array(namedItem).nullish() })
      .nullish()
      .catch(null),
    custom_fields: z.record(z.string(), z.unknown()).nullish().catch(null),
    event_instances: z
      .array(
        z.object({
          event_instance: z.object({
            id: z.number(),
            start: z.string(),
            end: z.string().nullish(),
            all_day: z.boolean().nullish(),
          }),
        }),
      )
      .min(1),
  }),
});
type LocalistEvent = z.infer<typeof localistEventSchema>["event"];

// Campus-time date strings for the API window: from yesterday (so events that
// ended in the last 24h are kept) through DAYS_AHEAD days from today.
export const fetchWindow = (now: Date): { start: string; end: string } => ({
  start: formatInTimeZone(subDays(now, 1), SOURCE_TIME_ZONE, "yyyy-MM-dd"),
  // `end` is exclusive, so add one day to include the last day.
  end: formatInTimeZone(addDays(now, DAYS_AHEAD + 1), SOURCE_TIME_ZONE, "yyyy-MM-dd"),
});

export const buildPageUrl = (
  baseUrl: string,
  window: { start: string; end: string },
  page: number,
): string => {
  const params = new URLSearchParams({
    start: window.start,
    end: window.end,
    pp: String(PAGE_SIZE),
    page: String(page),
  });
  return `${baseUrl}/api/2/events?${params.toString()}`;
};

const stringField = (fields: Record<string, unknown> | null | undefined, key: string) => {
  const value = fields?.[key];
  return typeof value === "string" ? nullIfEmpty(value) : null;
};

// "Students, Students - Graduates" -> "Students": drop subgroups whose parent is listed.
const collapseAudienceGroups = (names: string[]): string[] => {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  return unique.filter((name) => {
    const parent = name.split(" - ")[0];
    return parent === name || !unique.includes(parent ?? "");
  });
};

const RSVP_IN_TICKET_TEXT = /\brsvp\b|\bregist(?:er|ration)\b|\bsign[- ]?up\b|\btickets?\b|\bwaitlist\b/i;
const RSVP_IN_DESCRIPTION =
  /\brsvp\b|\bregistration (?:is )?(?:required|mandatory)\b|\bmust register\b|\bregister (?:here|now|online|to attend|in advance|by)\b/i;
const RSVP_NOT_NEEDED = /\bno rsvp\b|\brsvp (?:is )?not (?:required|needed|necessary)\b|\bno registration\b/i;

export interface AudienceInput {
  restrictedTo: string | null;
  audienceGroups: string[];
  hasRegister: boolean;
  ticketUrl: string | null;
  ticketText: string;
  description: string;
}

export const deriveAudience = (
  input: AudienceInput,
): { audience: Audience; audienceNote: string | null } => {
  if (input.restrictedTo) {
    return { audience: "restricted", audienceNote: input.restrictedTo };
  }

  const groups = collapseAudienceGroups(input.audienceGroups);
  const isOpen = groups.some((group) => OPEN_AUDIENCE_GROUPS.has(group.toLowerCase()));
  const audienceNote = !isOpen && groups.length > 0 ? groups.join(", ") : null;

  const needsRsvp =
    !RSVP_NOT_NEEDED.test(`${input.ticketText} ${input.description}`) &&
    (input.hasRegister ||
      input.ticketUrl !== null ||
      RSVP_IN_TICKET_TEXT.test(input.ticketText) ||
      RSVP_IN_DESCRIPTION.test(input.description));

  if (needsRsvp) return { audience: "rsvp", audienceNote };
  if (isOpen) return { audience: "open", audienceNote: null };
  return { audience: "unknown", audienceNote };
};

const ROOM_NUMBER = /^[a-z]?\d+[a-z]?$/i;

const buildLocationName = (event: LocalistEvent): string | null => {
  const place = nullIfEmpty(event.location_name) ?? nullIfEmpty(event.location);
  const room = nullIfEmpty(event.room_number);
  if (place && room) {
    if (place.includes(room)) return place;
    return `${place}, ${ROOM_NUMBER.test(room) ? `Room ${room}` : room}`;
  }
  return place ?? room ?? nullIfEmpty(event.address);
};

const buildCost = (event: LocalistEvent): string | null =>
  nullIfEmpty(event.ticket_cost) ?? (event.free ? "Free" : null);

const CANCELLED = /cancel{1,2}ed|postponed/i;

export const normalizeLocalistEvent = (raw: RawEvent): NormalizedEvent | null => {
  const parsed = localistEventSchema.safeParse(raw);
  if (!parsed.success) {
    const rawId = z.object({ event: z.object({ id: z.number() }) }).safeParse(raw);
    logSkip(
      LOCALIST_SOURCE,
      rawId.success ? String(rawId.data.event.id) : "unknown",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    );
    return null;
  }

  const event = parsed.data.event;
  const instance = event.event_instances[0]!.event_instance;
  const rawId = `${event.id}/${instance.id}`;
  const title = cleanInlineText(event.title);

  if (event.private) {
    logSkip(LOCALIST_SOURCE, rawId, "private event");
    return null;
  }
  if ((event.status && CANCELLED.test(event.status)) || /^\W*(?:cancel{1,2}ed|postponed)\b/i.test(title)) {
    logSkip(LOCALIST_SOURCE, rawId, "cancelled or postponed");
    return null;
  }

  const startTime = parseSourceTime(instance.start);
  if (!startTime) {
    logSkip(LOCALIST_SOURCE, rawId, `unparseable start time "${instance.start}"`);
    return null;
  }
  const allDay = instance.all_day ?? false;
  const endTime = resolveEndTime(startTime, parseSourceTime(instance.end), allDay);

  const description = htmlToText(event.description) || htmlToText(event.description_text);
  const ticketText = [event.ticket_cost, stringField(event.custom_fields, "banner_text")]
    .filter(Boolean)
    .join(" ");

  const { audience, audienceNote } = deriveAudience({
    restrictedTo: stringField(event.custom_fields, "restricted_to"),
    audienceGroups: (event.filters?.event_audience ?? []).map((group) => group.name),
    hasRegister: event.has_register ?? false,
    ticketUrl: nullIfEmpty(event.ticket_url),
    ticketText,
    description,
  });

  const departments = (event.departments ?? []).map((d) => cleanInlineText(d.name)).filter(Boolean);

  return validateNormalized(LOCALIST_SOURCE, rawId, {
    source: LOCALIST_SOURCE,
    sourceEventId: String(instance.id),
    sourceUrl: event.localist_url,
    title,
    description,
    startTime,
    endTime,
    allDay,
    locationName: buildLocationName(event),
    lat: parseCoordinate(event.geo?.latitude),
    lng: parseCoordinate(event.geo?.longitude),
    hostOrg: departments.length > 0 ? departments.join(", ") : null,
    audience,
    audienceNote,
    cost: buildCost(event),
    isVirtual: event.experience === "virtual",
  } satisfies NormalizedEvent);
};

export interface LocalistAdapterOptions {
  http: HttpClient;
  baseUrl?: string;
  now?: () => Date;
}

export const createLocalistAdapter = ({
  http,
  baseUrl = LOCALIST_BASE_URL,
  now = () => new Date(),
}: LocalistAdapterOptions): SourceAdapter => ({
  name: LOCALIST_SOURCE,

  async fetch(): Promise<RawEvent[]> {
    const window = fetchWindow(now());
    const events: RawEvent[] = [];

    for (let page = 1; ; page++) {
      const response = await http.getText(buildPageUrl(baseUrl, window, page));

      let json: unknown;
      try {
        json = JSON.parse(response.body);
      } catch (error) {
        throw new SourceFetchError(`Page ${page} is not valid JSON`, response.body, { cause: error });
      }

      const envelope = pageEnvelopeSchema.safeParse(json);
      if (!envelope.success) {
        throw new SourceFetchError(
          `Page ${page} has an unexpected shape: ${envelope.error.issues[0]?.message ?? "unknown"}`,
          response.body,
        );
      }
      if (envelope.data.page.total > MAX_PAGES) {
        throw new SourceFetchError(
          `Window needs ${envelope.data.page.total} pages, over the ${MAX_PAGES}-page cap`,
          response.body,
        );
      }

      events.push(...envelope.data.events);
      if (!envelope.data.page.next_page || page >= envelope.data.page.total) break;
    }

    return events;
  },

  normalize: normalizeLocalistEvent,
});
