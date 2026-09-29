import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makePublished } from "../../__tests__/factories.js";
import {
  EMPTY_SNAPSHOT,
  SnapshotFormatError,
  parseSnapshot,
  readSnapshotFile,
  serializeSnapshot,
  writeSnapshotFile,
  type EventSnapshot,
} from "../eventSnapshot.js";
import { loadSnapshot } from "../eventStore.js";

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "snapshot-test-"));
  file = path.join(dir, "data", "events.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const snapshot: EventSnapshot = {
  updatedAt: new Date("2026-09-28T10:00:00Z"),
  events: [
    makePublished("later", { startTime: new Date("2026-10-02T19:00:00Z"), endTime: null }),
    makePublished("sooner"),
  ],
};

describe("snapshot file format", () => {
  it("round-trips through serialize and parse", () => {
    const parsed = parseSnapshot(serializeSnapshot(snapshot));
    expect(parsed.updatedAt).toEqual(snapshot.updatedAt);
    expect(parsed.events.map((e) => e.sourceEventId)).toEqual(["sooner", "later"]);
    expect(parsed.events[0]?.startTime).toBeInstanceOf(Date);
    expect(parsed.events[1]?.endTime).toBeNull();
  });

  it("is stable: the same events always serialize identically", () => {
    const reversed = { ...snapshot, events: [...snapshot.events].reverse() };
    expect(serializeSnapshot(reversed)).toBe(serializeSnapshot(snapshot));
  });

  it("drops unknown keys before writing", () => {
    const withExtra = { ...snapshot, events: [{ ...makePublished("a"), secret: "x" }] };
    expect(serializeSnapshot(withExtra)).not.toContain("secret");
  });

  it("refuses to write invalid events", () => {
    expect(() => serializeSnapshot({ ...snapshot, events: [makePublished("a", { title: "" })] })).toThrow();
  });
});

describe("readSnapshotFile / writeSnapshotFile", () => {
  it("treats a missing file as an empty snapshot", async () => {
    expect(await readSnapshotFile(file)).toEqual(EMPTY_SNAPSHOT);
  });

  it("writes (creating the directory) and reads back", async () => {
    await writeSnapshotFile(file, snapshot);
    expect((await readSnapshotFile(file)).events).toHaveLength(2);
    expect(await readFile(file, "utf8")).toMatch(/\n$/);
  });

  it("rejects a malformed file with a clear error", async () => {
    await writeSnapshotFile(file, snapshot);
    await writeFile(file, '{"events": [{"title": 1}]}', "utf8");
    await expect(readSnapshotFile(file)).rejects.toBeInstanceOf(SnapshotFormatError);
  });
});

describe("loadSnapshot (server cache)", () => {
  it("returns an empty snapshot when there is no data yet", async () => {
    expect(await loadSnapshot(file)).toEqual(EMPTY_SNAPSHOT);
  });

  it("reloads when the file changes", async () => {
    await writeSnapshotFile(file, snapshot);
    expect((await loadSnapshot(file)).events).toHaveLength(2);

    await writeSnapshotFile(file, { ...snapshot, events: [makePublished("only")] });
    // Force a different mtime even on filesystems with coarse timestamps.
    const later = new Date(Date.now() + 5000);
    await utimes(file, later, later);
    expect((await loadSnapshot(file)).events.map((e) => e.sourceEventId)).toEqual(["only"]);
  });
});
