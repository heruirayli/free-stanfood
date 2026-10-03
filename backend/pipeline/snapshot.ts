import { formatInTimeZone } from "date-fns-tz";
import { byStartThenId, serializeEvents, type EventSnapshot } from "../models/eventSnapshot.js";
import type { Classification, Event, NormalizedEvent } from "../types/event.js";
import { LISTED_THRESHOLD } from "./classify/keywords.js";
import { assessCounts } from "./health.js";
import { SOURCE_TIME_ZONE, eventId } from "./normalize.js";

// Turns this run's per-source results plus the previous snapshot into the next
// published snapshot. Pure: no I/O, so every rule here is unit-tested.

export type ClassifiedEvent = NormalizedEvent & Classification;

export interface SourceResult {
  source: string;
  ok: boolean;
  // See SourceAdapter.allowEmpty.
  allowEmpty?: boolean;
  fetched: number;
  normalized: number;
  events: ClassifiedEvent[];
}

export interface SourceReport {
  source: string;
  published: number;
  keptFromPrevious: number;
  // Events dropped because an earlier source already listed the same event.
  duplicates: number;
  warnings: string[];
}

// Events are kept until 24 hours after they end (or start, if no end time).
const RETENTION_AFTER_END_MS = 24 * 60 * 60 * 1000;

export const expiresAtFor = (event: Pick<NormalizedEvent, "startTime" | "endTime">): Date =>
  new Date((event.endTime ?? event.startTime).getTime() + RETENTION_AFTER_END_MS);

export const isExpired = (event: Pick<NormalizedEvent, "startTime" | "endTime">, now: Date): boolean =>
  expiresAtFor(event) <= now;

// Only food events open to the public in some form are published. The data file
// is public (it's committed to the repo), so restricted events never go in it.
export const isPublishable = (event: ClassifiedEvent): boolean =>
  event.hasFreeFood && event.audience !== "restricted";

// Listings that repeat more often than weekly (daily exhibitions) without an
// explicit offer almost always point at one dated occasion ("Opening reception
// Oct 1, light refreshments"), not every day. Detected from the spacing of the
// instances, not their count, so a series' last days in the window are caught too.
const DAILY_GAP_DAYS = 6;

const seriesKey = (event: ClassifiedEvent): string =>
  [event.source, event.title, event.description].join("\u0000");

const campusDay = (date: Date): string => formatInTimeZone(date, SOURCE_TIME_ZONE, "yyyy-MM-dd");

const dayNumber = (date: Date): number => Date.parse(`${campusDay(date)}T00:00:00Z`) / 86_400_000;

// True when two instances fall on different campus days less than a week apart.
const repeatsMoreThanWeekly = (starts: Date[]): boolean => {
  const days = [...new Set(starts.map(dayNumber))].sort((a, b) => a - b);
  return days.some((day, i) => i > 0 && day - days[i - 1]! < DAILY_GAP_DAYS);
};

export const dropWeakDailySeries = (events: ClassifiedEvent[]): ClassifiedEvent[] => {
  const starts = new Map<string, Date[]>();
  for (const event of events) starts.set(seriesKey(event), [...(starts.get(seriesKey(event)) ?? []), event.startTime]);
  return events.filter(
    (event) => event.foodConfidence >= LISTED_THRESHOLD || !repeatsMoreThanWeekly(starts.get(seriesKey(event)) ?? []),
  );
};

// The same talk often appears on Stanford Events and on a center's own calendar.
// Match on the campus day plus the first six words of the title (sources differ
// in trailing punctuation, emoji, and suffixes like "| Stanford"). Titles of one
// or two words ("Office Hours") must also start at the same time. Returns null
// when the title has no words to compare (e.g. emoji only).
export const duplicateKey = (event: Pick<Event, "title" | "startTime">): string | null => {
  const words = event.title.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const when = formatInTimeZone(event.startTime, SOURCE_TIME_ZONE, words.length <= 2 ? "yyyy-MM-dd HH:mm" : "yyyy-MM-dd");
  return `${when}|${words.slice(0, 6).join(" ")}`;
};

// Which source owns each duplicate key: the first in adapter order to list it
// (Stanford Events comes first and carries the richest audience and cost data).
// Every listing claims its key, including restricted and no-food ones, so a
// restricted Stanford Events listing also keeps its calendar-feed copy out.
const claimDuplicateKeys = (results: SourceResult[], previous: EventSnapshot, now: Date): Map<string, string> => {
  const owners = new Map<string, string>();
  for (const result of results) {
    const previouslyPublished = previous.events.filter((event) => event.source === result.source && !isExpired(event, now));
    for (const event of [...result.events, ...previouslyPublished]) {
      const key = duplicateKey(event);
      if (key !== null && !owners.has(key)) owners.set(key, result.source);
    }
  }
  return owners;
};

// Listings a host asked us to remove (data/removed.json), matched by their source URL.
export type RemovedUrls = ReadonlySet<string>;

const toPublished = (event: ClassifiedEvent, previous: Map<string, Event>, now: Date): Event => {
  const id = eventId(event.source, event.sourceEventId);
  return { ...event, id, firstSeenAt: previous.get(id)?.firstSeenAt ?? now };
};

export const buildSnapshot = (
  previous: EventSnapshot,
  results: SourceResult[],
  now: Date,
  removedUrls: RemovedUrls = new Set(),
): { snapshot: EventSnapshot; reports: SourceReport[]; changed: boolean } => {
  const previousById = new Map(previous.events.map((event) => [event.id, event]));
  const owners = claimDuplicateKeys(results, previous, now);
  const collected: Event[] = [];
  const reports: SourceReport[] = [];

  // Sources no longer in the adapter list are dropped with their events.
  for (const result of results) {
    const isOwn = (event: Pick<Event, "title" | "startTime">): boolean => {
      const key = duplicateKey(event);
      return key === null || owners.get(key) === result.source;
    };
    const isWanted = (event: Event): boolean => isOwn(event) && !removedUrls.has(event.sourceUrl);
    // Compared like for like: both counts are still current and exclude duplicates.
    const stillCurrent = previous.events.filter((event) => event.source === result.source && !isExpired(event, now));
    const candidates = result.events.filter((event) => isPublishable(event) && !isExpired(event, now));
    const fresh = dropWeakDailySeries(candidates.filter(isOwn))
      .map((event) => toPublished(event, previousById, now))
      .filter(isWanted);

    let published: Event[];
    let warnings: string[] = [];

    if (!result.ok) {
      // The source failed: keep serving what we had rather than going blank.
      published = stillCurrent.filter(isWanted);
    } else {
      const previousCount = stillCurrent.filter(isOwn).length;
      warnings = assessCounts(
        result.source,
        { fetched: result.fetched, normalized: result.normalized, published: fresh.length },
        previousCount > 0 ? previousCount : null,
        { allowEmpty: result.allowEmpty },
      );
      if (warnings.length > 0) {
        // Suspicious counts: add what's new but keep what we had, except events this
        // run saw and rejected (now restricted, no food, or removed).
        const seenIds = new Set(result.events.map((event) => eventId(event.source, event.sourceEventId)));
        published = [...fresh, ...stillCurrent.filter((event) => !seenIds.has(event.id) && isWanted(event))];
        warnings.push(`${result.source}: kept previously published events because the counts look unhealthy.`);
      } else {
        published = fresh;
      }
    }

    collected.push(...published);
    reports.push({
      source: result.source,
      published: published.length,
      keptFromPrevious: published.filter((event) => !fresh.includes(event)).length,
      duplicates: candidates.filter((event) => !isOwn(event)).length,
      warnings,
    });
  }

  const events = collected.sort(byStartThenId);
  const changed = serializeEvents(events) !== serializeEvents(previous.events);
  return {
    snapshot: { updatedAt: changed || !previous.updatedAt ? now : previous.updatedAt, events },
    reports,
    changed,
  };
};
