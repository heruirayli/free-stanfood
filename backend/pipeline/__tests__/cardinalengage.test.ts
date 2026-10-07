import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCardinalEngageAdapter,
  normalizeCardinalEngageEvent,
  parseRssFeed,
} from "../adapters/cardinalengage.js";
import { SourceFetchError } from "../adapters/types.js";
import { classifyByKeywords, LISTED_THRESHOLD } from "../classify/keywords.js";
import type { HttpClient } from "../http.js";
import type { NormalizedEvent } from "../../types/event.js";
import { readFixture } from "./helpers.js";

// The fixture is the live feed saved on 2026-10-06.
const NOW = () => new Date("2026-10-06T12:00:00Z");
const FEED = readFixture("cardinalengage-rss.xml");

const fakeHttp = (body: string, requested: string[] = []): HttpClient => ({
  async getText(url) {
    requested.push(url);
    return { url, status: 200, body, notModified: false };
  },
});

const normalizeAll = async (body = FEED) => {
  const adapter = createCardinalEngageAdapter({ http: fakeHttp(body), now: NOW });
  const raw = await adapter.fetch();
  return { raw, events: raw.map((item) => adapter.normalize(item)).filter((e): e is NormalizedEvent => e !== null) };
};

const byTitle = (events: NormalizedEvent[], title: string) => events.find((e) => e.title.startsWith(title));

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("cardinalengage adapter", () => {
  it("normalizes every item in the public feed", async () => {
    const { raw, events } = await normalizeAll();
    expect(raw).toHaveLength(24);
    expect(events).toHaveLength(24);
  });

  it("maps fields, reading ISO times with their offset", async () => {
    const lasa = byTitle((await normalizeAll()).events, "LASA: a conversation with Bernardo Parnes");
    expect(lasa).toMatchObject({
      source: "cardinalengage",
      sourceEventId: "2266468",
      sourceUrl: "https://cardinalengage.stanford.edu/GSBLASA/rsvp?id=2266468",
      hostOrg: "GSB Latin American Student Association",
      allDay: false,
      isVirtual: false,
      locationName: null,
      foodProvided: false,
    });
    expect(lasa?.startTime.toISOString()).toBe("2026-10-06T19:00:00.000Z"); // noon PDT
    expect(lasa?.endTime?.toISOString()).toBe("2026-10-06T20:00:00.000Z");
    expect(lasa?.title).toContain("Deutsche Bank LATAM, Bradesco BBI & Merrill Lynch");
  });

  it("keeps a real venue but never the sign-in placeholder", async () => {
    const { events } = await normalizeAll();
    expect(byTitle(events, "GCBC Welcome Back Hotpot Night")?.locationName).toBe("Haidilao");
    expect(events.some((e) => /private location|sign in/i.test(e.locationName ?? ""))).toBe(false);
  });

  it("treats members-only privacy levels as restricted", async () => {
    const { events } = await normalizeAll();
    const thanksgiving = byTitle(events, "Canadian Thanksgiving Dinner");
    expect(thanksgiving).toMatchObject({ audience: "restricted", audienceNote: "Members only (CardinalEngage)" });
    expect(events.filter((e) => e.audience === "restricted")).toHaveLength(8);
  });

  it("passes the host's food checkbox to the classifier", async () => {
    const tapIns = byTitle((await normalizeAll()).events, "BBSA Tap Ins");
    expect(tapIns?.foodProvided).toBe(true);
    expect(tapIns?.audience).not.toBe("restricted");
    expect(classifyByKeywords(tapIns!).foodConfidence).toBeGreaterThanOrEqual(LISTED_THRESHOLD);
  });

  it("skips deleted and unapproved events", () => {
    const [first] = parseRssFeed(FEED);
    expect(normalizeCardinalEngageEvent({ ...first, eventDelete: "1" })).toBeNull();
    expect(normalizeCardinalEngageEvent({ ...first, approvalStatus: "0" })).toBeNull();
    expect(normalizeCardinalEngageEvent({ ...first, eventStartDateTime: "soon" })).toBeNull();
  });

  it("leaves out events more than a year ahead", async () => {
    const later = FEED.replace("2026-10-06T12:00:00.0000000-07:00", "2028-03-01T12:00:00.0000000-08:00");
    const { raw } = await normalizeAll(later);
    expect(raw).toHaveLength(23);
  });

  it("requests the feed and rejects responses that aren't RSS", async () => {
    const requested: string[] = [];
    await createCardinalEngageAdapter({ http: fakeHttp(FEED, requested), now: NOW }).fetch();
    expect(requested).toEqual(["https://cardinalengage.stanford.edu/rss_events"]);
    const adapter = createCardinalEngageAdapter({ http: fakeHttp("<html>Sign in</html>"), now: NOW });
    await expect(adapter.fetch()).rejects.toBeInstanceOf(SourceFetchError);
  });

  it("treats an empty channel as quiet, not broken", async () => {
    const empty = '<?xml version="1.0"?><rss version="2.0"><channel><title>stanfordu Events</title></channel></rss>';
    const adapter = createCardinalEngageAdapter({ http: fakeHttp(empty), now: NOW });
    expect(await adapter.fetch()).toEqual([]);
    expect(adapter.allowEmpty).toBe(true);
  });
});
