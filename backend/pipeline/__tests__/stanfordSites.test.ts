import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STANFORD_SITES,
  createStanfordSiteAdapter,
  eventsUrl,
  normalizeSiteEvent,
  parseSiteResponse,
  siteSourceName,
  type StanfordSite,
} from "../adapters/stanfordSites.js";
import { SourceFetchError } from "../adapters/types.js";
import type { HttpClient } from "../http.js";
import type { NormalizedEvent } from "../../types/event.js";
import { readFixture } from "./helpers.js";

const ICME: StanfordSite = { id: "icme", name: "Institute for Computational & Mathematical Engineering", host: "icme.stanford.edu" };
// The fixture was saved on this day.
const SAVED = () => new Date("2026-10-08T19:00:00Z");

type Raw = { id: string; audiences: string[]; attributes: Record<string, unknown> };

const fixtureRaw = (): Raw[] => parseSiteResponse(JSON.parse(readFixture("stanford-sites-icme.json"))) as Raw[];

const normalizeAll = (raw: Raw[]): NormalizedEvent[] =>
  raw.map((item) => normalizeSiteEvent(ICME, item)).filter((e): e is NormalizedEvent => e !== null);

const byTitle = (events: NormalizedEvent[], title: string) => events.find((e) => e.title.startsWith(title));

const fakeHttp = (body: string, requested: { url: string; accept?: string; retries?: number }[] = []): HttpClient => ({
  async getText(url, options) {
    requested.push({ url, accept: options?.accept, retries: options?.retries });
    return { url, status: 200, body, notModified: false };
  },
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Stanford Sites adapter", () => {
  it("normalizes a department's own events, with the hook from the dek", () => {
    const lunch = byTitle(normalizeAll(fixtureRaw()), "Industry Insider: Mathematical Frontiers");
    expect(lunch).toMatchObject({
      source: "site:icme",
      sourceUrl: expect.stringMatching(/^https:\/\/icme\.stanford\.edu\/events\//),
      startTime: new Date("2026-10-22T19:00:00Z"),
      endTime: new Date("2026-10-22T20:00:00Z"),
      allDay: false,
      locationName: "The Hive",
      hostOrg: "Institute for Computational & Mathematical Engineering",
      // "RSVP HERE" call to action; the site lists it for students.
      audience: "rsvp",
      audienceNote: "Students",
      isVirtual: false,
    });
    expect(lunch?.description.startsWith("Lunch & Learn")).toBe(true);
  });

  it("skips a series entered as one span over weeks", () => {
    const events = normalizeAll(fixtureRaw());
    expect(byTitle(events, "CME 299")).toBeUndefined();
    expect(events).toHaveLength(4);
  });

  it("skips events copied from Stanford Events", () => {
    const raw = fixtureRaw();
    raw[1]!.attributes = { ...raw[1]!.attributes, su_event_localist_id: "1234567" };
    raw[2]!.attributes = { ...raw[2]!.attributes, su_event_source: { uri: "https://events.stanford.edu/event/x" } };
    expect(normalizeAll(raw)).toHaveLength(2);
  });

  it("recognizes all-day events and open audiences", () => {
    const [item] = fixtureRaw().filter((r) => String(r.attributes.title).startsWith("ICME Career Forum"));
    if (!item) throw new Error("fixture event missing");
    item.attributes = {
      ...item.attributes,
      su_event_date_time: { value: "2026-11-05T08:00:00+00:00", end_value: "2026-11-06T07:59:00+00:00" },
      su_event_cta: null,
    };
    item.audiences = ["General Public", "Students"];
    expect(normalizeSiteEvent(ICME, item)).toMatchObject({ allDay: true, audience: "open", audienceNote: null });
  });

  it("treats a restriction in the text as restricted", () => {
    const [item] = fixtureRaw().filter((r) => String(r.attributes.title).startsWith("Industry Insider: Cerebras"));
    if (!item) throw new Error("fixture event missing");
    item.attributes = { ...item.attributes, su_event_dek: "Lunch provided. Open to Stanford students only." };
    expect(normalizeSiteEvent(ICME, item)).toMatchObject({ audience: "restricted" });
  });

  it("rejects entries that don't match the expected shape", () => {
    expect(normalizeSiteEvent(ICME, { id: "x", audiences: [], attributes: { title: "No dates" } })).toBeNull();
  });
});

describe("Stanford Sites fetching", () => {
  it("asks once, without retries, for upcoming events and only the fields it uses", async () => {
    const requested: { url: string; accept?: string; retries?: number }[] = [];
    const adapter = createStanfordSiteAdapter({ http: fakeHttp(readFixture("stanford-sites-icme.json"), requested), site: ICME, now: SAVED });
    expect(await adapter.fetch()).toHaveLength(5);
    expect(requested).toHaveLength(1);
    expect(requested[0]).toMatchObject({ accept: "application/vnd.api+json", retries: 0 });

    const url = new URL(requested[0]!.url);
    expect(url.origin + url.pathname).toBe("https://icme.stanford.edu/jsonapi/node/stanford_event");
    // From campus midnight, so the URL holds all day.
    expect(url.searchParams.get("filter[upcoming][condition][value]")).toBe(String(Date.parse("2026-10-08T07:00:00Z") / 1000));
    expect(url.searchParams.get("include")).toBe("su_event_audience");
    const fields = url.searchParams.get("fields[node--stanford_event]")?.split(",") ?? [];
    expect(fields).toContain("su_event_date_time");
    expect(fields).not.toContain("su_event_email");
    expect(fields).not.toContain("su_event_telephone");
  });

  it("rejects responses that aren't JSON:API", async () => {
    const html = createStanfordSiteAdapter({ http: fakeHttp("<html>Sign in</html>"), site: ICME, now: SAVED });
    await expect(html.fetch()).rejects.toBeInstanceOf(SourceFetchError);
    const wrong = createStanfordSiteAdapter({ http: fakeHttp('{"errors":[{"title":"Forbidden"}]}'), site: ICME, now: SAVED });
    await expect(wrong.fetch()).rejects.toBeInstanceOf(SourceFetchError);
  });

  it("gives every site its own source name and an https URL", () => {
    const names = STANFORD_SITES.map(siteSourceName);
    expect(new Set(names).size).toBe(names.length);
    for (const site of STANFORD_SITES) expect(eventsUrl(site, SAVED())).toMatch(new RegExp(`^https://${site.host}/jsonapi/`));
  });
});
