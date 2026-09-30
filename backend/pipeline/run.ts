import path from "node:path";
import dotenv from "dotenv";
import { EVENTS_FILE } from "../config/paths.js";
import {
  EMPTY_SNAPSHOT,
  readSnapshotFile,
  writeSnapshotFile,
  type EventSnapshot,
} from "../models/eventSnapshot.js";
import { createIcalAdapter } from "./adapters/ical.js";
import { ICAL_FEEDS } from "./adapters/icalFeeds.js";
import { createLocalistAdapter } from "./adapters/localist.js";
import type { SourceAdapter } from "./adapters/types.js";
import { createHttpClient, MemoryResponseCache } from "./http.js";
import { processSource, type SourceRun } from "./processSource.js";
import { buildSnapshot, type SourceReport } from "./snapshot.js";

// Pipeline entrypoint (`npm run pipeline`). Runs as its own process (locally or
// in GitHub Actions) and writes data/events.json. Never imported by the server.

dotenv.config({ quiet: true });

const buildAdapters = (contactEmail: string): SourceAdapter[] => {
  const http = createHttpClient({ contactEmail, cache: new MemoryResponseCache() });
  // Stanford Events first: when two sources list the same event, the first one wins.
  return [createLocalistAdapter({ http }), ...ICAL_FEEDS.map((feed) => createIcalAdapter({ http, feed }))];
};

// In GitHub Actions these lines become annotations on the workflow run.
const report = (level: "warning" | "error", message: string): void => {
  const prefix = process.env.GITHUB_ACTIONS === "true" ? `::${level}::` : `${level.toUpperCase()}: `;
  console.error(`${prefix}${message}`);
};

// A corrupt previous snapshot shouldn't wedge every future run: start fresh.
const loadPrevious = async (): Promise<EventSnapshot> => {
  try {
    return await readSnapshotFile(EVENTS_FILE);
  } catch (error) {
    report("warning", `Ignoring unreadable ${EVENTS_FILE}: ${error instanceof Error ? error.message : error}`);
    return EMPTY_SNAPSHOT;
  }
};

const printSummary = (runs: SourceRun[], reports: SourceReport[]): void => {
  console.table(
    runs.map((run) => {
      const sourceReport = reports.find((r) => r.source === run.source);
      return {
        source: run.source,
        ok: run.ok,
        fetched: run.fetched,
        normalized: run.normalized,
        skipped: run.skipped,
        food: run.foodEvents,
        published: sourceReport?.published ?? 0,
        duplicates: sourceReport?.duplicates ?? 0,
        keptFromPrevious: sourceReport?.keptFromPrevious ?? 0,
        seconds: Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 100) / 10,
      };
    }),
  );
};

const main = async (): Promise<void> => {
  const contactEmail = process.env.SCRAPER_CONTACT_EMAIL?.trim();
  if (!contactEmail) {
    console.error("SCRAPER_CONTACT_EMAIL is not set. It is sent in the User-Agent so sources can reach us.");
    process.exit(1);
  }
  if (contactEmail.endsWith("@example.com")) {
    report("warning", "SCRAPER_CONTACT_EMAIL is still the example address. Set a real one so sources can reach you.");
  }

  const adapters = buildAdapters(contactEmail);
  const previous = await loadPrevious();

  const runs: SourceRun[] = [];
  for (const adapter of adapters) {
    console.log(`[${adapter.name}] starting`);
    runs.push(await processSource(adapter));
  }

  const { snapshot, reports, changed } = buildSnapshot(previous, runs, new Date());
  const relativeFile = path.relative(process.cwd(), EVENTS_FILE);
  if (changed) {
    await writeSnapshotFile(EVENTS_FILE, snapshot);
    console.log(`Wrote ${snapshot.events.length} events to ${relativeFile}`);
  } else {
    console.log(`No changes to ${relativeFile} (${snapshot.events.length} events)`);
  }
  printSummary(runs, reports);

  let unhealthy = false;
  for (const run of runs) {
    if (run.error) {
      report("error", `${run.source} failed: ${run.error}`);
      unhealthy = true;
    }
  }
  for (const warning of reports.flatMap((r) => r.warnings)) {
    report("warning", warning);
    unhealthy = true;
  }
  // Healthy sources were already saved. A non-zero exit makes the scheduled job fail loudly.
  if (unhealthy) process.exitCode = 1;
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
