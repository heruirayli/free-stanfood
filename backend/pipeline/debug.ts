import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Writes a failed source response to debug/ (gitignored) for offline diagnosis.
export const saveDebugDump = async (
  source: string,
  body: string,
  directory: string = path.resolve("debug"),
): Promise<string> => {
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  // Source names like "ical:luma-ceas" contain characters Windows and artifact uploads reject.
  const name = source.replace(/[^\w.-]+/g, "_");
  const file = path.join(directory, `${name}-${stamp}.txt`);
  await writeFile(file, body, "utf8");
  return file;
};
