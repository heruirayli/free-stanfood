import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRemovalList, readRemovalList } from "../removalList.js";

describe("removal list", () => {
  it("returns the removed listing URLs", () => {
    const text = JSON.stringify({
      removed: [{ url: "https://events.stanford.edu/event/abc", note: "Host request, 2026-10-01" }],
    });
    expect(parseRemovalList(text)).toEqual(new Set(["https://events.stanford.edu/event/abc"]));
  });

  it("treats a missing file as an empty list", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "removed-"));
    expect(await readRemovalList(path.join(dir, "removed.json"))).toEqual(new Set());
  });

  it("refuses an invalid file instead of ignoring it", async () => {
    const file = path.join(await mkdtemp(path.join(tmpdir(), "removed-")), "removed.json");
    await writeFile(file, JSON.stringify({ removed: [{ url: "not a url" }] }), "utf8");
    await expect(readRemovalList(file)).rejects.toThrow(/not a valid removal list/);
  });
});
