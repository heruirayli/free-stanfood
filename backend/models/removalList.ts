import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// data/removed.json: listings hosts asked us to take down. Keyed by the
// listing's source URL, so every date of a recurring series goes at once.

const removalFileSchema = z.object({
  removed: z.array(
    z.object({
      url: z.url(),
      // Who asked and when, e.g. "Host request, 2026-10-01".
      note: z.string().min(1),
    }),
  ),
});

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export const parseRemovalList = (text: string): Set<string> =>
  new Set(removalFileSchema.parse(JSON.parse(text)).removed.map((entry) => entry.url));

// A missing file means nothing was removed. An invalid one throws, so a typo
// can't quietly republish listings a host asked us to remove.
export const readRemovalList = async (file: string): Promise<Set<string>> => {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (isNotFound(error)) return new Set();
    throw error;
  }
  try {
    return parseRemovalList(text);
  } catch (error) {
    throw new Error(`${path.basename(file)} is not a valid removal list`, { cause: error });
  }
};
