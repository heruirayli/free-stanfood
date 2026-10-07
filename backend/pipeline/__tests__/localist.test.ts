import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_PAGES,
  buildPageUrl,
  createLocalistAdapter,
  deriveAudience,
  fetchWindow,
  normalizeLocalistEvent,
} from "../adapters/localist.js";
import { SourceFetchError } from "../adapters/types.js";
import type { HttpClient } from "../http.js";
import { allFixtureEvents, fixtureEvent, loadLocalistPage, type LocalistPage } from "./helpers.js";

// Localist event ids of representative fixture entries.
const LUNCH_AND_LEARN = 53361362013832; // entity-encoded title, ticket_url, no audience tags
const PARFAIT = 54046536048246; // restricted_to a program's students
const STVP = 53993202461342; // restricted_to + banner text + registration cost text
const ADD_DROP = 53887333129629; // all-day, virtual, no location
const CANTOR = 52881224936195; // all-day, no end, no departments, "Everyone"
const CYCLING = 53428556578558; // ticket_url, cost "Varies", no end time
const WORSHIP = 53889137015268; // "Everyone", no ticketing
const BREAKFAST = 53977701841236; // student audience tags + ticket_url

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeLocalistEvent", () => {
  it("normalizes every fixture event into a valid record", () => {
    const entries = allFixtureEvents();
    const normalized = entries.map(normalizeLocalistEvent);
    expect(entries.length).toBe(100);
    expect(normalized.every((event) => event !== null)).toBe(true);
  });

  it("maps core fields and decodes entities in titles", () => {
    const event = normalizeLocalistEvent(fixtureEvent(LUNCH_AND_LEARN));
    expect(event).toMatchObject({
      source: "localist",
      sourceEventId: "53361362015882",
      sourceUrl:
        "https://events.stanford.edu/event/shared-resources-at-wu-tsai-neuro-amp-sarafan-chem-h-lunch-amp-learn",
      title: "Shared Resources at Wu Tsai Neuro & Sarafan ChEM-H: Lunch & Learn",
      allDay: false,
      locationName: "Stanford Neurosciences Building",
      lat: 37.430178,
      lng: -122.176478,
      hostOrg: "Wu Tsai Neurosciences Institute",
      audience: "rsvp",
      audienceNote: null,
      cost: null,
      isVirtual: false,
    });
    // 12:00-13:00 PDT
    expect(event?.startTime.toISOString()).toBe("2026-09-29T19:00:00.000Z");
    expect(event?.endTime?.toISOString()).toBe("2026-09-29T20:00:00.000Z");
    expect(event?.description).not.toMatch(/<[a-z]/i);
    expect(event?.description.length).toBeGreaterThan(0);
  });

  it("marks events with a restricted_to note as restricted", () => {
    const parfait = normalizeLocalistEvent(fixtureEvent(PARFAIT));
    expect(parfait?.audience).toBe("restricted");
    expect(parfait?.audienceNote).toBe("Earth Systems Program students");
    expect(parfait?.locationName).toBe("Y2E2 Building, Room 131");

    const stvp = normalizeLocalistEvent(fixtureEvent(STVP));
    expect(stvp?.audience).toBe("restricted");
    expect(stvp?.audienceNote).toBe("Current Stanford students and postdocs");
    expect(stvp?.cost).toBe("Free to Current Students — Register");
    expect(stvp?.locationName).toBe(
      "Jen-Hsun Huang Building (School of Engineering), Mackenzie (Huang 300)",
    );
  });

  it("handles all-day virtual events with no location", () => {
    const event = normalizeLocalistEvent(fixtureEvent(ADD_DROP));
    expect(event?.allDay).toBe(true);
    expect(event?.isVirtual).toBe(true);
    expect(event?.locationName).toBeNull();
    expect(event?.lat).toBeNull();
    // Midnight to 23:59 PDT.
    expect(event?.startTime.toISOString()).toBe("2026-09-28T07:00:00.000Z");
    expect(event?.endTime?.toISOString()).toBe("2026-09-29T06:59:00.000Z");
  });

  it("ends all-day events without an end time at 23:59 campus time", () => {
    const event = normalizeLocalistEvent(fixtureEvent(CANTOR));
    expect(event?.allDay).toBe(true);
    expect(event?.startTime.toISOString()).toBe("2026-09-27T07:00:00.000Z");
    expect(event?.endTime?.toISOString()).toBe("2026-09-28T06:59:00.000Z");
  });

  it("handles missing departments", () => {
    const event = normalizeLocalistEvent(fixtureEvent(CANTOR));
    expect(event?.hostOrg).toBeNull();
    expect(event?.audience).toBe("open");
    expect(event?.locationName).toBe("Cantor Arts Center, Lynn Krywick Gibbons Gallery");
  });

  it("treats a ticket URL as RSVP and keeps the cost text", () => {
    const event = normalizeLocalistEvent(fixtureEvent(CYCLING));
    expect(event?.audience).toBe("rsvp");
    expect(event?.cost).toBe("Varies");
    expect(event?.endTime).toBeNull();
  });

  it("drops an end time that is the same clock time the next day", () => {
    // Several real listings (a Thursday noon seminar series) end "noon Friday".
    const raw = fixtureEvent(WORSHIP);
    raw.event.event_instances = [
      {
        event_instance: {
          id: 1,
          start: "2026-09-27T11:00:00-07:00",
          end: "2026-09-28T11:00:00-07:00",
          all_day: false,
        },
      },
    ];
    const event = normalizeLocalistEvent(raw);
    expect(event?.startTime.toISOString()).toBe("2026-09-27T18:00:00.000Z");
    expect(event?.endTime).toBeNull();
  });

  it("marks 'Everyone' events without ticketing as open", () => {
    expect(normalizeLocalistEvent(fixtureEvent(WORSHIP))?.audience).toBe("open");
  });

  it("summarizes targeted audience groups as the note", () => {
    const event = normalizeLocalistEvent(fixtureEvent(BREAKFAST));
    expect(event?.audience).toBe("rsvp");
    expect(event?.audienceNote).toBe("Students");
  });

  it("skips private events", () => {
    const raw = fixtureEvent(WORSHIP);
    raw.event.private = true;
    expect(normalizeLocalistEvent(raw)).toBeNull();
  });

  it("skips cancelled events", () => {
    const raw = fixtureEvent(WORSHIP);
    raw.event.title = "CANCELED: University Public Worship";
    expect(normalizeLocalistEvent(raw)).toBeNull();
  });

  it("skips events whose status says cancelled, whatever the title", () => {
    const raw = fixtureEvent(WORSHIP);
    raw.event.status = "canceled";
    expect(normalizeLocalistEvent(raw)).toBeNull();
  });

  it("skips records with a missing title or unparseable start time", () => {
    const noTitle = fixtureEvent(WORSHIP);
    delete noTitle.event.title;
    expect(normalizeLocalistEvent(noTitle)).toBeNull();

    const blankTitle = fixtureEvent(WORSHIP);
    blankTitle.event.title = "   ";
    expect(normalizeLocalistEvent(blankTitle)).toBeNull();

    const badStart = fixtureEvent(WORSHIP);
    badStart.event.event_instances = [
      { event_instance: { id: 1, start: "next tuesday", end: null, all_day: false } },
    ];
    expect(normalizeLocalistEvent(badStart)).toBeNull();
  });

  it("rejects input that isn't a Localist event", () => {
    expect(normalizeLocalistEvent(null)).toBeNull();
    expect(normalizeLocalistEvent({ event: { id: "abc" } })).toBeNull();
  });

  it("tolerates odd optional fields without dropping the event", () => {
    const raw = fixtureEvent(WORSHIP);
    raw.event.custom_fields = [];
    raw.event.departments = "not a list";
    raw.event.geo = { latitude: "n/a", longitude: null };
    const event = normalizeLocalistEvent(raw);
    expect(event).not.toBeNull();
    expect(event?.hostOrg).toBeNull();
    expect(event?.lat).toBeNull();
  });
});

describe("deriveAudience", () => {
  const base = {
    restrictedTo: null,
    audienceGroups: [],
    hasRegister: false,
    ticketUrl: null,
    ticketText: "",
    title: "",
    description: "",
  };

  it("treats a restriction stated only in the text like a 'restricted to' note", () => {
    const cases = [
      { description: "Lunch will be provided. This event is exclusively for Stanford community members." },
      { description: "Open to all Stanford Undergraduates" },
      { description: "This event is open to all enrolled graduate students and requires advanced registration." },
      { title: "Art & Boba Talk | STANFORD AFFILIATES ONLY" },
    ];
    for (const fields of cases) {
      expect(deriveAudience({ ...base, ticketUrl: "https://example.edu/rsvp", ...fields }).audience).toBe("restricted");
    }
    expect(deriveAudience({ ...base, description: "Open to all Stanford affiliates." }).audienceNote).toBe(
      "Open to all Stanford affiliates.",
    );
  });

  it("doesn't restrict events that also welcome the public", () => {
    expect(deriveAudience({ ...base, description: "Open to Stanford affiliates and the general public." }).audience).toBe("unknown");
    expect(deriveAudience({ ...base, description: "Free and open to the public." }).audience).toBe("unknown");
  });

  it("returns unknown when there are no signals", () => {
    expect(deriveAudience(base)).toEqual({ audience: "unknown", audienceNote: null });
  });

  it("detects RSVP wording in the description", () => {
    expect(deriveAudience({ ...base, description: "Please RSVP here (Lunch will be served)" }).audience).toBe("rsvp");
  });

  it("respects explicit 'no RSVP' wording", () => {
    expect(
      deriveAudience({ ...base, audienceGroups: ["Everyone"], description: "No RSVP required." }).audience,
    ).toBe("open");
  });

  it("detects RSVP wording in the cost text", () => {
    expect(
      deriveAudience({ ...base, ticketText: "Free and open to the public. RSVP for location." }).audience,
    ).toBe("rsvp");
  });
});

describe("fetchWindow", () => {
  it("covers yesterday through a year ahead in campus time", () => {
    // 13:00 PDT on Sep 28
    expect(fetchWindow(new Date("2026-09-28T20:00:00Z"))).toEqual({
      start: "2026-09-27",
      end: "2027-09-29",
    });
  });

  it("uses the campus date, not the UTC date", () => {
    // 23:30 PDT on Sep 28 is already Sep 29 in UTC.
    expect(fetchWindow(new Date("2026-09-29T06:30:00Z")).start).toBe("2026-09-27");
  });
});

describe("createLocalistAdapter().fetch", () => {
  const fakeHttp = (pages: Record<number, string>, requested: string[] = []): HttpClient => ({
    async getText(url) {
      requested.push(url);
      const page = Number(new URL(url).searchParams.get("page"));
      const body = pages[page];
      if (body === undefined) throw new Error(`unexpected page ${page}`);
      return { url, status: 200, body, notModified: false };
    },
  });

  const twoPages = (): Record<number, string> => {
    const page1 = loadLocalistPage(1);
    const page2 = loadLocalistPage(2);
    page1.page = { ...page1.page, total: 2, next_page: 2 };
    page2.page = { ...page2.page, total: 2, next_page: null };
    return { 1: JSON.stringify(page1), 2: JSON.stringify(page2) };
  };

  it("follows pagination until the last page", async () => {
    const requested: string[] = [];
    const adapter = createLocalistAdapter({
      http: fakeHttp(twoPages(), requested),
      now: () => new Date("2026-09-28T20:00:00Z"),
    });
    const events = await adapter.fetch();
    expect(events).toHaveLength(100);
    expect(requested).toEqual([
      "https://events.stanford.edu/api/2/events?start=2026-09-27&end=2027-09-29&pp=100&page=1",
      "https://events.stanford.edu/api/2/events?start=2026-09-27&end=2027-09-29&pp=100&page=2",
    ]);
  });

  it("stops at the reported last page even if next_page is still set", async () => {
    const pages = twoPages();
    const last = JSON.parse(pages[2]!) as LocalistPage;
    last.page = { ...last.page, next_page: 3 };
    const requested: string[] = [];
    const adapter = createLocalistAdapter({ http: fakeHttp({ ...pages, 2: JSON.stringify(last) }, requested) });
    await adapter.fetch();
    expect(requested).toHaveLength(2);
  });

  it("fails loudly instead of fetching past the page cap", async () => {
    const page1 = loadLocalistPage(1);
    page1.page = { ...page1.page, total: MAX_PAGES + 1, next_page: 2 };
    const adapter = createLocalistAdapter({ http: fakeHttp({ 1: JSON.stringify(page1) }) });
    await expect(adapter.fetch()).rejects.toBeInstanceOf(SourceFetchError);
  });

  it("attaches the raw body when a page isn't JSON", async () => {
    const adapter = createLocalistAdapter({ http: fakeHttp({ 1: "<html>maintenance</html>" }) });
    const error = await adapter.fetch().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceFetchError);
    expect((error as SourceFetchError).rawBody).toBe("<html>maintenance</html>");
  });

  it("rejects a page with an unexpected shape", async () => {
    const adapter = createLocalistAdapter({ http: fakeHttp({ 1: JSON.stringify({ items: [] }) }) });
    await expect(adapter.fetch()).rejects.toThrow(/unexpected shape/);
  });

  it("builds page URLs with the verified parameters", () => {
    expect(buildPageUrl("https://example.edu", { start: "2026-01-01", end: "2026-01-02" }, 3)).toBe(
      "https://example.edu/api/2/events?start=2026-01-01&end=2026-01-02&pp=100&page=3",
    );
  });
});
