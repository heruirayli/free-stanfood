import { normalizedEventSchema, type Classification, type NormalizedEvent } from "../types/event.js";
import { SourceFetchError, type SourceAdapter } from "./adapters/types.js";
import { classifyByKeywords } from "./classify/keywords.js";
import { saveDebugDump } from "./debug.js";
import { HttpError } from "./http.js";
import { isExpired, isPublishable, type ClassifiedEvent, type SourceResult } from "./snapshot.js";

export interface ProcessSourceDeps {
  classify?: (event: NormalizedEvent) => Classification;
  now?: () => Date;
  saveDebug?: (source: string, body: string) => Promise<string>;
}

export interface SourceRun extends SourceResult {
  startedAt: Date;
  finishedAt: Date;
  skipped: number;
  foodEvents: number;
  error: string | null;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const rawBodyOf = (error: unknown): string | undefined => {
  if (error instanceof SourceFetchError) return error.rawBody;
  if (error instanceof HttpError) return error.body;
  return undefined;
};

// Runs one adapter end to end: fetch, normalize, classify. Never throws, because
// one source failing must not stop the others.
export const processSource = async (
  adapter: SourceAdapter,
  { classify = classifyByKeywords, now = () => new Date(), saveDebug = saveDebugDump }: ProcessSourceDeps = {},
): Promise<SourceRun> => {
  const run: SourceRun = {
    source: adapter.name,
    startedAt: now(),
    finishedAt: now(),
    ok: false,
    fetched: 0,
    normalized: 0,
    skipped: 0,
    foodEvents: 0,
    error: null,
    events: [],
  };

  try {
    const raw = await adapter.fetch();
    run.fetched = raw.length;

    // Keyed by sourceEventId: pagination can shift mid-run and repeat an entry.
    const events = new Map<string, ClassifiedEvent>();
    const fetchedAt = now();
    for (const item of raw) {
      let normalized: NormalizedEvent | null = null;
      try {
        normalized = adapter.normalize(item);
      } catch (error) {
        console.warn(`[${adapter.name}] normalize threw: ${errorMessage(error)}`);
      }
      const valid = normalized ? normalizedEventSchema.safeParse(normalized) : null;
      // Also skip events already past retention. The source's date window is
      // day-granular, so it returns some.
      if (!valid?.success || isExpired(valid.data, fetchedAt)) {
        run.skipped++;
        continue;
      }
      events.set(valid.data.sourceEventId, { ...valid.data, ...classify(valid.data) });
    }

    run.events = [...events.values()];
    run.normalized = run.events.length;
    run.foodEvents = run.events.filter(isPublishable).length;
    run.ok = true;
  } catch (error) {
    run.error = errorMessage(error);
    console.error(`[${adapter.name}] failed: ${run.error}`);
    const body = rawBodyOf(error);
    if (body !== undefined) {
      try {
        const file = await saveDebug(adapter.name, body);
        console.error(`[${adapter.name}] raw response saved to ${file}`);
      } catch (dumpError) {
        console.error(`[${adapter.name}] could not save debug dump: ${errorMessage(dumpError)}`);
      }
    }
  }

  run.finishedAt = now();
  return run;
};
