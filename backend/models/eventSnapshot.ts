import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { eventSchema, type Event } from "../types/event.js";

// The on-disk format of data/events.json, shared by the pipeline (writer) and
// the server (reader). It is pretty-printed with a fixed key and event order so
// git diffs between runs show only real changes.

export interface EventSnapshot {
  // Last time the published events changed (not the last time the pipeline ran).
  updatedAt: Date | null;
  events: Event[];
}

export const EMPTY_SNAPSHOT: EventSnapshot = { updatedAt: null, events: [] };

// On disk, dates are ISO 8601 strings.
const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const storedEventSchema = eventSchema.extend({
  startTime: isoDate,
  endTime: isoDate.nullable(),
  firstSeenAt: isoDate,
});

const snapshotFileSchema = z.object({
  updatedAt: isoDate.nullable(),
  events: z.array(storedEventSchema),
});

export class SnapshotFormatError extends Error {
  constructor(file: string, cause: unknown) {
    // Basename only: this message can reach API clients via the error handler.
    super(`Event data file ${path.basename(file)} is not a valid snapshot`, { cause });
    this.name = "SnapshotFormatError";
  }
}

export const parseSnapshot = (text: string): EventSnapshot => snapshotFileSchema.parse(JSON.parse(text));

export const byStartThenId = (a: Event, b: Event): number =>
  a.startTime.getTime() - b.startTime.getTime() || a.id.localeCompare(b.id);

// Validates every event (and drops unknown keys) before it is written.
const canonicalEvents = (events: Event[]): Event[] =>
  events.map((event) => eventSchema.parse(event)).sort(byStartThenId);

export const serializeEvents = (events: Event[]): string =>
  JSON.stringify(canonicalEvents(events), null, 2);

export const serializeSnapshot = (snapshot: EventSnapshot): string =>
  `${JSON.stringify({ updatedAt: snapshot.updatedAt, events: canonicalEvents(snapshot.events) }, null, 2)}\n`;

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

// A missing file is an empty snapshot (for example before the first pipeline run).
export const readSnapshotFile = async (file: string): Promise<EventSnapshot> => {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (isNotFound(error)) return EMPTY_SNAPSHOT;
    throw error;
  }
  try {
    return parseSnapshot(text);
  } catch (error) {
    throw new SnapshotFormatError(file, error);
  }
};

// Writes to a temp file and renames it, so readers never see a half-written file.
export const writeSnapshotFile = async (file: string, snapshot: EventSnapshot): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await writeFile(temp, serializeSnapshot(snapshot), "utf8");
  await rename(temp, file);
};
