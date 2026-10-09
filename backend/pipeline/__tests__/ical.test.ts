import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  costFromOffers,
  createIcalAdapter,
  normalizeIcalEvent,
  parseIcalFeed,
  readLumaPage,
  type IcalFeed,
} from "../adapters/ical.js";
import { ICAL_FEEDS } from "../adapters/icalFeeds.js";
import { SourceFetchError } from "../adapters/types.js";
import { HttpError, type HttpClient } from "../http.js";
import { processSource } from "../processSource.js";
import type { NormalizedEvent } from "../../types/event.js";
import { readFixture } from "./helpers.js";

const FEED: IcalFeed = {
  id: "edge-club",
  name: "Edge Case Club",
  url: "https://calendar.example.edu/edge.ics",
  homepage: "https://example.edu/edge-club",
};

// Window runs from Oct 19 to Dec 16, 2026.
const NOW = new Date("2026-10-20T19:00:00Z");
const now = () => NOW;

const fakeHttp = (body: string, requested: string[] = []): HttpClient => ({
  async getText(url) {
    requested.push(url);
    return { url, status: 200, body, notModified: false };
  },
});

const normalizeAll = async (feed: IcalFeed, body: string, at = now) => {
  const adapter = createIcalAdapter({ http: fakeHttp(body), feed, now: at });
  const raw = await adapter.fetch();
  return { raw, events: raw.map((item) => adapter.normalize(item)).filter((e): e is NormalizedEvent => e !== null) };
};

const byTitle = (events: NormalizedEvent[], title: string) => events.filter((e) => e.title.startsWith(title));

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("ical adapter: edge cases", () => {
  it("expands a weekly series across DST, skipping EXDATEs and applying overrides", async () => {
    const { events } = await normalizeAll(FEED, readFixture("ical-edge-cases.ics"));
    const weekly = byTitle(events, "Weekly club lunch");
    expect(weekly.map((e) => e.startTime.toISOString())).toEqual([
      "2026-10-26T19:00:00.000Z", // 12:00 PDT
      "2026-11-02T20:00:00.000Z", // 12:00 PST, after the Nov 1 change
      // Nov 9 is an EXDATE
      "2026-11-16T21:00:00.000Z", // moved to 13:00 PST by a RECURRENCE-ID override
      "2026-11-23T20:00:00.000Z",
    ]);
    expect(weekly[2]?.title).toBe("Weekly club lunch (moved to 1pm)");
    // The moved occurrence keeps the id of the slot it replaced.
    expect(weekly[2]?.sourceEventId).toBe("weekly-lunch@example.edu@2026-11-16T20:00:00.000Z");
    expect(new Set(weekly.map((e) => e.sourceEventId)).size).toBe(4);
  });

  it("maps fields and falls back to the feed for host, audience, and link", async () => {
    const { events } = await normalizeAll(FEED, readFixture("ical-edge-cases.ics"));
    const lunch = byTitle(events, "Weekly club lunch")[0];
    expect(lunch).toMatchObject({
      source: "ical:edge-club",
      sourceUrl: "https://example.edu/edge-club",
      description: "Free pizza provided every week.",
      locationName: "Old Union Room 200",
      hostOrg: "Edge Case Club",
      audience: "unknown",
      isVirtual: false,
      endTime: new Date("2026-10-26T20:00:00.000Z"),
    });
  });

  it("uses the event's own URL and strips HTML from descriptions", async () => {
    const { events } = await normalizeAll(FEED, readFixture("ical-edge-cases.ics"));
    const boba = byTitle(events, "Boba giveaway day")[0];
    expect(boba?.sourceUrl).toBe("https://example.edu/events/boba-day");
    expect(boba?.description).toBe("Free boba all day at White Plaza.");
  });

  it("marks events with an online location as virtual", async () => {
    const { events } = await normalizeAll(FEED, readFixture("ical-edge-cases.ics"));
    const online = byTitle(events, "Online speaker series")[0];
    expect(online).toMatchObject({ isVirtual: true, locationName: null });
  });

  it("skips private, cancelled, untitled, and out-of-window events", async () => {
    const { raw, events } = await normalizeAll(FEED, readFixture("ical-edge-cases.ics"));
    const titles = events.map((e) => e.title);
    expect(titles).not.toContain("Board meeting (dinner provided)");
    expect(titles).not.toContain("Cancelled donut social");
    expect(titles).not.toContain("Winter social from last year");
    expect(events.every((e) => e.title.length > 0)).toBe(true);
    // 4 weekly + boba + retreat + private + cancelled + untitled + online = 10 in the window.
    expect(raw).toHaveLength(10);
    expect(events).toHaveLength(7);
  });

  describe.each(["UTC", "Asia/Tokyo", "America/Los_Angeles"])("all-day events with TZ=%s", (tz) => {
    let original: string | undefined;
    beforeAll(() => {
      original = process.env.TZ;
      process.env.TZ = tz;
    });
    afterAll(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it("keeps the listed calendar dates in campus time", async () => {
      const { events } = await normalizeAll(FEED, readFixture("ical-edge-cases.ics"));
      const boba = byTitle(events, "Boba giveaway day")[0];
      expect(boba?.allDay).toBe(true);
      expect(boba?.startTime.toISOString()).toBe("2026-10-28T07:00:00.000Z"); // midnight PDT
      expect(boba?.endTime?.toISOString()).toBe("2026-10-29T06:59:00.000Z"); // 23:59 the same day

      // DTEND 2026-11-01 is exclusive, so the retreat ends Oct 31 at 23:59 PDT.
      const retreat = byTitle(events, "Officer retreat")[0];
      expect(retreat?.startTime.toISOString()).toBe("2026-10-30T07:00:00.000Z");
      expect(retreat?.endTime?.toISOString()).toBe("2026-11-01T06:59:00.000Z");
    });
  });
});

describe("ical adapter: zones, cancellations, and locations", () => {
  const vevent = (fields: string[]) => ["BEGIN:VEVENT", ...fields, "END:VEVENT"];
  const FEED_BODY = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...vevent(["UID:floating", "DTSTART:20261028T120000", "DTEND:20261028T130000", "SUMMARY:Floating lunch"]),
    ...vevent(["UID:bogus-zone", "DTSTART;TZID=Campus Standard Time:20261028T120000", "SUMMARY:Unknown zone lunch"]),
    ...vevent(["UID:cancelled-title", "DTSTART:20261028T190000Z", "SUMMARY:CANCELLED: Pizza night"]),
    ...vevent(["UID:confidential", "DTSTART:20261028T190000Z", "CLASS:CONFIDENTIAL", "SUMMARY:Staff lunch"]),
    ...vevent(["UID:hybrid", "DTSTART:20261028T190000Z", "LOCATION:Encina Hall 101, https://stanford.zoom.us/j/123", "SUMMARY:Hybrid talk with lunch"]),
    ...vevent(["UID:zoom-only", "DTSTART:20261028T190000Z", "LOCATION:Zoom: https://stanford.zoom.us/j/456", "SUMMARY:Webinar"]),
    ...vevent(["UID:orphan", "RECURRENCE-ID:20261104T190000Z", "DTSTART:20261104T200000Z", "SUMMARY:Moved coffee hour"]),
    ...vevent(["UID:plain", "DTSTART:20261028T190000Z", "SUMMARY:Tacos <3", "DESCRIPTION:Snacks if 3 < 4 people RSVP > 2 days ahead."]),
    ...vevent(["UID:daily-boba", "DTSTART;VALUE=DATE:20261027", "RRULE:FREQ=DAILY;COUNT=2", "SUMMARY:Boba week"]),
    ...vevent(["UID:open-weekly", "DTSTART:20261021T190000Z", "RRULE:FREQ=WEEKLY", "SUMMARY:Endless weekly pizza"]),
    ...vevent(["UID:far-future", "DTSTART:20280115T190000Z", "SUMMARY:Pizza in 2028"]),
    "END:VCALENDAR",
  ].join("\r\n");

  describe.each(["UTC", "America/Los_Angeles"])("with TZ=%s", (tz) => {
    let original: string | undefined;
    beforeAll(() => {
      original = process.env.TZ;
      process.env.TZ = tz;
    });
    afterAll(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it("reads floating times and unknown zones as campus time", async () => {
      const { events } = await normalizeAll(FEED, FEED_BODY);
      expect(byTitle(events, "Floating lunch")[0]?.startTime.toISOString()).toBe("2026-10-28T19:00:00.000Z");
      expect(byTitle(events, "Unknown zone lunch")[0]?.startTime.toISOString()).toBe("2026-10-28T19:00:00.000Z");
    });

    it("keys all-day occurrences by their calendar date", async () => {
      const { events } = await normalizeAll(FEED, FEED_BODY);
      expect(byTitle(events, "Boba week").map((e) => e.sourceEventId)).toEqual(["daily-boba@2026-10-27", "daily-boba@2026-10-28"]);
    });
  });

  it("skips titles marked cancelled and CLASS:CONFIDENTIAL events", async () => {
    const titles = (await normalizeAll(FEED, FEED_BODY)).events.map((e) => e.title);
    expect(titles).not.toContain("CANCELLED: Pizza night");
    expect(titles).not.toContain("Staff lunch");
  });

  it("keeps hybrid events in person and shows the room, not the link", async () => {
    const { events } = await normalizeAll(FEED, FEED_BODY);
    expect(byTitle(events, "Hybrid talk")[0]).toMatchObject({ isVirtual: false, locationName: "Encina Hall 101" });
    expect(byTitle(events, "Webinar")[0]).toMatchObject({ isVirtual: true, locationName: null });
  });

  it("keeps an override whose series isn't in the feed", async () => {
    const moved = byTitle((await normalizeAll(FEED, FEED_BODY)).events, "Moved coffee hour");
    expect(moved.map((e) => e.sourceEventId)).toEqual(["orphan@2026-11-04T19:00:00.000Z"]);
  });

  it("stops a year ahead, even for series with no end", async () => {
    const { events } = await normalizeAll(FEED, FEED_BODY);
    const windowEnd = new Date("2027-10-22T00:00:00Z");
    const weekly = byTitle(events, "Endless weekly pizza");
    expect(weekly.length).toBeGreaterThanOrEqual(50);
    expect(weekly.every((e) => e.startTime < windowEnd)).toBe(true);
    expect(byTitle(events, "Pizza in 2028")).toEqual([]);
  });

  it("keeps plain-text angle brackets", async () => {
    const plain = byTitle((await normalizeAll(FEED, FEED_BODY)).events, "Tacos")[0];
    expect(plain?.title).toBe("Tacos <3");
    expect(plain?.description).toBe("Snacks if 3 < 4 people RSVP > 2 days ahead.");
  });
});

describe("ical adapter: real Luma feed", () => {
  const LUMA: IcalFeed = {
    id: "luma-europe-center",
    name: "The Europe Center",
    url: "https://api.luma.com/ics/get?entity=calendar&id=cal-Lmfg1IJGEOc4oZE",
    homepage: "https://luma.com/The_Europe_Center",
    audience: "rsvp",
  };
  // The fixture was saved on this day.
  const SAVED = () => new Date("2026-09-30T12:00:00Z");

  it("normalizes Luma events with their own links, coordinates, and addresses", async () => {
    const { events } = await normalizeAll(LUMA, readFixture("luma-europe-center.ics"), SAVED);
    const seminar = byTitle(events, "Milada Vachudova")[0];
    expect(seminar).toMatchObject({
      source: "ical:luma-europe-center",
      sourceUrl: "https://luma.com/63p6t1ul",
      startTime: new Date("2026-10-22T19:00:00.000Z"),
      endTime: new Date("2026-10-22T20:15:00.000Z"),
      locationName: "Encina Hall, 616 Jane Stanford Way C100, Stanford, CA 94305, USA",
      lat: 37.4273185,
      hostOrg: "The Europe Center",
      audience: "rsvp",
      isVirtual: false,
    });
    // The "Get up-to-date information at: <link>" line becomes the link, not description.
    expect(seminar?.description.startsWith("Address:")).toBe(true);
    expect(events.every((e) => e.sourceUrl.startsWith("https://luma.com/"))).toBe(true);
  });

  it("keeps TENTATIVE events (Luma marks everything tentative)", async () => {
    const { events } = await normalizeAll(LUMA, readFixture("luma-europe-center.ics"), SAVED);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe("ical adapter: fetching", () => {
  it("requests the feed URL and rejects responses that aren't calendars", async () => {
    const requested: string[] = [];
    const ok = createIcalAdapter({ http: fakeHttp(readFixture("ical-edge-cases.ics"), requested), feed: FEED, now });
    await ok.fetch();
    expect(requested).toEqual([FEED.url]);

    const bad = createIcalAdapter({ http: fakeHttp("<html>Sign in</html>"), feed: FEED, now });
    const error = await bad.fetch().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceFetchError);
    expect((error as SourceFetchError).rawBody).toBe("<html>Sign in</html>");
  });

  it("treats an empty calendar as quiet, not broken", async () => {
    const empty = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//EN\r\nEND:VCALENDAR\r\n";
    const adapter = createIcalAdapter({ http: fakeHttp(empty), feed: FEED, now });
    expect(adapter.allowEmpty).toBe(true);
    const run = await processSource(adapter, { now });
    expect(run).toMatchObject({ ok: true, fetched: 0, normalized: 0, allowEmpty: true });
  });

  it("rejects raw entries that don't match the expected shape", () => {
    expect(normalizeIcalEvent(FEED, { summary: "no uid or times" })).toBeNull();
  });

  it("parses without network access", () => {
    const raw = parseIcalFeed(readFixture("ical-edge-cases.ics"), {
      from: new Date("2026-10-19T00:00:00Z"),
      to: new Date("2026-10-27T00:00:00Z"),
    });
    expect(raw.map((r) => (r as { occurrenceKey: string }).occurrenceKey)).toContain(
      "weekly-lunch@example.edu@2026-10-26T19:00:00.000Z",
    );
  });
});

// Serves each URL its own body; a URL with no body fails like a 404.
const routedHttp = (routes: Record<string, string>, requested: { url: string; retries?: number }[] = []): HttpClient => ({
  async getText(url, options) {
    requested.push({ url, retries: options?.retries });
    const body = routes[url];
    if (body === undefined) throw new HttpError(404, url, "Not found");
    return { url, status: 200, body, notModified: false };
  },
});

describe("ical adapter: Luma event pages", () => {
  const LUMA: IcalFeed = {
    id: "luma-europe-center",
    name: "The Europe Center",
    url: "https://api.luma.com/ics/get?entity=calendar&id=cal-Lmfg1IJGEOc4oZE",
    homepage: "https://luma.com/The_Europe_Center",
    audience: "rsvp",
    eventPages: "luma",
  };
  // The feed fixture was saved on this day: its events are Oct 22, Nov 19, and Dec 3.
  const SAVED = () => new Date("2026-09-30T12:00:00Z");
  const page = readFixture("luma-event-page.html");

  it("reads a page's description and price from its JSON-LD", () => {
    const { description, cost } = readLumaPage(page);
    expect(description).toContain("FOOD TRUCKS!!! from Speedy Panini and GrillZillas");
    expect(description).toContain("Free coffee first come first serve");
    expect(cost).toBe("Free");
    expect(readLumaPage("<html><body>No data</body></html>")).toEqual({ description: null, cost: null });
  });

  it("calls tickets free, priced, or mixed", () => {
    expect(costFromOffers([{ price: 0 }, { price: "0" }])).toBe("Free");
    expect(costFromOffers({ price: 15 })).toBe("$15");
    expect(costFromOffers([{ price: 10 }, { price: 25 }])).toBe("$10–$25");
    expect(costFromOffers([{ price: 0 }, { price: 25 }])).toBeNull(); // a free tier exists
    expect(costFromOffers(undefined)).toBeNull();
  });

  it("uses each upcoming event's page for its description, within 60 days", async () => {
    const requested: { url: string }[] = [];
    const http = routedHttp(
      { [LUMA.url]: readFixture("luma-europe-center.ics"), "https://luma.com/63p6t1ul": page },
      requested,
    );
    const adapter = createIcalAdapter({ http, feed: LUMA, now: SAVED });
    const events = (await adapter.fetch()).map((raw) => adapter.normalize(raw)).filter((e): e is NormalizedEvent => e !== null);

    // The feed, then pages for Oct 22 and Nov 19. Dec 3 is more than 60 days out.
    expect(requested.map((r) => r.url)).toEqual([LUMA.url, "https://luma.com/63p6t1ul", expect.stringMatching(/^https:\/\/luma\.com\//)]);
    const seminar = byTitle(events, "Milada Vachudova")[0];
    expect(seminar?.description).toContain("FOOD TRUCKS!!!");
    expect(seminar?.cost).toBe("Free");
    // A page that couldn't be read leaves the feed's description.
    const other = byTitle(events, "Jannis Panagiotidis")[0];
    expect(other?.description.startsWith("Address:")).toBe(true);
    expect(other?.cost).toBeNull();
  });

  it("reads pages for every Luma feed in the list", () => {
    const luma = ICAL_FEEDS.filter((feed) => feed.url.startsWith("https://api.luma.com/"));
    expect(luma.length).toBeGreaterThan(0);
    expect(luma.every((feed) => feed.eventPages === "luma")).toBe(true);
  });
});

describe("ical adapter: audience", () => {
  const LAW = ICAL_FEEDS.find((feed) => feed.id === "stanford-law");
  // The fixture was saved on this day (it holds Oct 5 – Oct 20 events).
  const SAVED = () => new Date("2026-10-08T12:00:00Z");

  it("reads the Law School's audience line", async () => {
    if (!LAW) throw new Error("stanford-law feed missing");
    const { events } = await normalizeAll(LAW, readFixture("stanford-law.ics"), SAVED);
    const audience = (title: string) => {
      const event = byTitle(events, title)[0];
      return event && [event.audience, event.audienceNote];
    };
    expect(audience("Private Lunch")).toEqual(["restricted", "Stanford Law School community"]);
    expect(audience("JD/MBA Dinner")).toEqual(["restricted", "Invitation only"]);
    expect(audience("How Americans Enforce the Law")).toEqual(["open", null]);
    expect(audience("Lunch Conversation")).toEqual(["unknown", "Stanford community"]);
  });

  it("shows the Law School's venues without the '@' and country", async () => {
    if (!LAW) throw new Error("stanford-law feed missing");
    const { events } = await normalizeAll(LAW, readFixture("stanford-law.ics"), SAVED);
    const week = byTitle(events, "SLS Wellness Week")[0];
    expect(week).toMatchObject({ allDay: true, hostOrg: "Stanford Law School" });
    expect(week?.locationName).toBe("SLS, Crown Quadrangle, 559 Nathan Abbott Way, Stanford, CA, 94305-8610");
  });

  it("makes one request to the Law School per run, without retries", async () => {
    if (!LAW) throw new Error("stanford-law feed missing");
    const requested: { url: string; retries?: number }[] = [];
    const adapter = createIcalAdapter({ http: routedHttp({ [LAW.url]: readFixture("stanford-law.ics") }, requested), feed: LAW, now: SAVED });
    await adapter.fetch();
    expect(requested).toEqual([{ url: LAW.url, retries: 0 }]);
  });

  it("lets a limit in the text outrank the Law School's broader line", () => {
    if (!LAW) throw new Error("stanford-law feed missing");
    const raw = {
      uid: "contracts@law.stanford.edu",
      occurrenceKey: "contracts@law.stanford.edu",
      allDay: false,
      start: "2026-10-26T19:50:00.000Z",
      end: "2026-10-26T21:00:00.000Z",
      summary: "Beyond the Doctrine: Contracts",
      description: "Lunch provided. Open to all SLS students.\n\nThis event is open to the Stanford community.",
      location: null,
      url: "https://law.stanford.edu/event/beyond-the-doctrine-contracts/",
      status: null,
      classification: null,
      lat: null,
      lng: null,
    };
    expect(normalizeIcalEvent(LAW, raw)).toMatchObject({ audience: "restricted", audienceNote: "Open to all SLS students." });
  });

  it("treats a restriction in any feed's text as restricted", () => {
    const raw = {
      uid: "talk@example.edu",
      occurrenceKey: "talk@example.edu",
      allDay: false,
      start: "2026-10-21T19:00:00.000Z",
      end: "2026-10-21T20:00:00.000Z",
      summary: "Lunch talk",
      description: "Pizza provided. Open to Stanford students only.",
      location: "Gates 104",
      url: null,
      status: null,
      classification: null,
      lat: null,
      lng: null,
    };
    expect(normalizeIcalEvent(FEED, raw)).toMatchObject({ audience: "restricted", audienceNote: "Open to Stanford students only." });
  });
});
