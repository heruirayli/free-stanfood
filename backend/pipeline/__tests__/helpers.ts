import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

export const readFixture = (name: string): string =>
  readFileSync(path.join(fixturesDir, name), "utf8");

export interface LocalistPage {
  events: { event: Record<string, unknown> & { id: number } }[];
  page: { current: number; total: number; next_page: number | null } & Record<string, unknown>;
  [key: string]: unknown;
}

export const loadLocalistPage = (n: 1 | 2): LocalistPage =>
  JSON.parse(readFixture(`localist-page${n}.json`)) as LocalistPage;

export const allFixtureEvents = (): LocalistPage["events"] => [
  ...loadLocalistPage(1).events,
  ...loadLocalistPage(2).events,
];

// Returns a deep copy of the fixture entry for the given Localist event id.
export const fixtureEvent = (eventId: number): LocalistPage["events"][number] => {
  const found = allFixtureEvents().find((entry) => entry.event.id === eventId);
  if (!found) throw new Error(`Fixture event ${eventId} not found`);
  return structuredClone(found);
};
