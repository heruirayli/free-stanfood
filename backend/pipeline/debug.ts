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
  const file = path.join(directory, `${source}-${stamp}.txt`);
  await writeFile(file, body, "utf8");
  return file;
};
