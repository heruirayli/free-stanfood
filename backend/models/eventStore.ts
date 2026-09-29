import { stat } from "node:fs/promises";
import { EVENTS_FILE } from "../config/paths.js";
import { EMPTY_SNAPSHOT, readSnapshotFile, type EventSnapshot } from "./eventSnapshot.js";

// Read side for the Express server. The snapshot is cached in memory and
// reloaded only when the file's modification time changes, so a fresh
// `npm run pipeline` (or a deploy with new data) shows up without a restart.

interface CacheEntry {
  file: string;
  mtimeMs: number;
  snapshot: EventSnapshot;
}

let cache: CacheEntry | null = null;

export const loadSnapshot = async (file: string = EVENTS_FILE): Promise<EventSnapshot> => {
  let mtimeMs: number;
  try {
    mtimeMs = (await stat(file)).mtimeMs;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return EMPTY_SNAPSHOT;
    }
    throw error;
  }

  if (cache && cache.file === file && cache.mtimeMs === mtimeMs) return cache.snapshot;

  const snapshot = await readSnapshotFile(file);
  cache = { file, mtimeMs, snapshot };
  return snapshot;
};
