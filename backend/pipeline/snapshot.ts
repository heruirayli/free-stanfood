import { byStartThenId, serializeEvents, type EventSnapshot } from "../models/eventSnapshot.js";
import type { Classification, Event, NormalizedEvent } from "../types/event.js";
import { LIKELY_THRESHOLD } from "./classify/keywords.js";
import { assessCounts } from "./health.js";
import { eventId } from "./normalize.js";

// Turns this run's per-source results plus the previous snapshot into the next
// published snapshot. Pure: no I/O, so every rule here is unit-tested.

export type ClassifiedEvent = NormalizedEvent & Classification;

export interface SourceResult {
  source: string;
  ok: boolean;
  fetched: number;
  normalized: number;
  events: ClassifiedEvent[];
}

export interface SourceReport {
  source: string;
  published: number;
  keptFromPrevious: number;
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

// A weekly listing shows up at most 9 times in the 8-week window. Listings that
// repeat more often (daily exhibitions) with only a weak food hint almost always
// point at one dated occasion ("Reception to follow: Oct 1"), not every day.
export const MAX_WEEKLY_INSTANCES = 9;

const seriesKey = (event: ClassifiedEvent): string =>
  [event.source, event.title, event.description].join("\u0000");

export const dropWeakDailySeries = (events: ClassifiedEvent[]): ClassifiedEvent[] => {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(seriesKey(event), (counts.get(seriesKey(event)) ?? 0) + 1);
  return events.filter(
    (event) =>
      event.foodConfidence >= LIKELY_THRESHOLD || (counts.get(seriesKey(event)) ?? 0) <= MAX_WEEKLY_INSTANCES,
  );
};

const toPublished = (event: ClassifiedEvent, previous: Map<string, Event>, now: Date): Event => {
  const id = eventId(event.source, event.sourceEventId);
  return { ...event, id, firstSeenAt: previous.get(id)?.firstSeenAt ?? now };
};

export const buildSnapshot = (
  previous: EventSnapshot,
  results: SourceResult[],
  now: Date,
): { snapshot: EventSnapshot; reports: SourceReport[]; changed: boolean } => {
  const previousById = new Map(previous.events.map((event) => [event.id, event]));
  const events: Event[] = [];
  const reports: SourceReport[] = [];

  // Sources no longer in the adapter list are dropped with their events.
  for (const result of results) {
    const previousForSource = previous.events.filter((event) => event.source === result.source);
    const stillCurrent = previousForSource.filter((event) => !isExpired(event, now));
    const fresh = dropWeakDailySeries(
      result.events.filter((event) => isPublishable(event) && !isExpired(event, now)),
    ).map((event) => toPublished(event, previousById, now));

    let published: Event[];
    let warnings: string[] = [];

    if (!result.ok) {
      // The source failed: keep serving what we had rather than going blank.
      published = stillCurrent;
    } else {
      warnings = assessCounts(
        result.source,
        { fetched: result.fetched, normalized: result.normalized, published: fresh.length },
        previousForSource.length > 0 ? previousForSource.length : null,
      );
      if (warnings.length > 0) {
        // Suspicious counts: add what's new but don't drop anything we had.
        const freshIds = new Set(fresh.map((event) => event.id));
        published = [...fresh, ...stillCurrent.filter((event) => !freshIds.has(event.id))];
        warnings.push(`${result.source}: kept previously published events because the counts look unhealthy.`);
      } else {
        published = fresh;
      }
    }

    events.push(...published);
    reports.push({
      source: result.source,
      published: published.length,
      keptFromPrevious: published.filter((event) => !fresh.includes(event)).length,
      warnings,
    });
  }

  events.sort(byStartThenId);
  const changed = serializeEvents(events) !== serializeEvents(previous.events);
  return {
    snapshot: { updatedAt: changed || !previous.updatedAt ? now : previous.updatedAt, events },
    reports,
    changed,
  };
};
