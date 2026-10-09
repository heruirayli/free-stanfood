import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { EVENTS_FILE } from "../config/paths.js";
import { readSnapshotFile } from "../models/eventSnapshot.js";
import { PUBLIC_AUDIENCES, type Audience } from "../types/event.js";
import { selectEvents } from "../utils/eventFilter.js";
import { CALENDAR_MIN_CONFIDENCE, buildCalendar } from "../utils/ics.js";

// For hosting the site without the API (GitHub Pages): writes what the API would
// serve next to the built frontend, which then reads it in place of /api/events.
// - data/events.json: every published event (the app filters them itself)
// - calendar.ics: the calendar feed, as GET /api/events/calendar.ics serves it
// - 404.html: a copy of index.html, so deep links like /week start the app
//   (GitHub Pages serves 404.html for any path it has no file for)
// Usage: tsx backend/scripts/exportStatic.ts [frontend/dist]

const main = async (): Promise<void> => {
  const outDir = path.resolve(process.argv[2] ?? "frontend/dist");
  const now = new Date();
  const { events } = await readSnapshotFile(EVENTS_FILE);
  const published = events.filter((event) => (PUBLIC_AUDIENCES as readonly Audience[]).includes(event.audience));

  await mkdir(path.join(outDir, "data"), { recursive: true });
  await writeFile(path.join(outDir, "data", "events.json"), JSON.stringify(published), "utf8");
  const feed = selectEvents(published, { minConfidence: CALENDAR_MIN_CONFIDENCE }, now);
  await writeFile(path.join(outDir, "calendar.ics"), buildCalendar(feed, now), "utf8");
  await copyFile(path.join(outDir, "index.html"), path.join(outDir, "404.html"));
  console.log(`Wrote ${published.length} events and a ${feed.length}-event calendar feed to ${outDir}`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
