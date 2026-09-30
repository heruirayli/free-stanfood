import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeLocalistEvent } from "../adapters/localist.js";
import { SourceFetchError, type SourceAdapter } from "../adapters/types.js";
import { processSource } from "../processSource.js";
import { allFixtureEvents } from "./helpers.js";

// Fixture events start 2026-09-27 00:00 PDT, so none have expired yet at this instant.
const FIXTURE_NOW = new Date("2026-09-27T07:00:00Z");
const now = () => FIXTURE_NOW;

const fixtureAdapter = (): SourceAdapter => ({
  name: "localist",
  fetch: async () => allFixtureEvents(),
  normalize: normalizeLocalistEvent,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("processSource", () => {
  it("normalizes and classifies every fixture event", async () => {
    const run = await processSource(fixtureAdapter(), { now });
    expect(run).toMatchObject({ ok: true, fetched: 100, normalized: 100, skipped: 0, error: null });
    expect(run.events).toHaveLength(100);
    expect(run.events.every((event) => event.classifiedBy === "keywords")).toBe(true);
    expect(run.foodEvents).toBeGreaterThan(0);
    expect(run.foodEvents).toBeLessThan(100);
  });

  it("flags the lunch listing from the fixture as food", async () => {
    const run = await processSource(fixtureAdapter(), { now });
    const lunch = run.events.find((event) => event.sourceEventId === "53361362015882");
    expect(lunch?.hasFreeFood).toBe(true);
    expect(lunch?.foodDetails).toBe("lunch");
  });

  it("flags the sandwiches listing from the fixture as food", async () => {
    const run = await processSource(fixtureAdapter(), { now });
    const talk = run.events.find((event) => event.title.startsWith("UCLA’s Randall Kuhn"));
    expect(talk).toMatchObject({ hasFreeFood: true, foodDetails: "sandwiches" });
    expect(talk?.foodConfidence).toBeGreaterThanOrEqual(0.75);
    // Public listing, so it gets published (the audience is "rsvp").
    expect(talk?.audience).not.toBe("restricted");
  });

  it("records a failure, saves the raw body, and does not throw", async () => {
    const saveDebug = vi.fn(async () => "debug/localist.txt");
    const adapter: SourceAdapter = {
      name: "localist",
      fetch: async () => {
        throw new SourceFetchError("Page 1 is not valid JSON", "<html>oops</html>");
      },
      normalize: () => null,
    };

    const run = await processSource(adapter, { saveDebug, now });
    expect(run).toMatchObject({ ok: false, error: "Page 1 is not valid JSON", events: [] });
    expect(saveDebug).toHaveBeenCalledWith("localist", "<html>oops</html>");
  });

  it("skips records whose normalize throws or returns invalid data", async () => {
    const adapter: SourceAdapter = {
      name: "test",
      fetch: async () => ["boom", "invalid", "ok"],
      normalize: (raw) => {
        if (raw === "boom") throw new Error("bad record");
        const base = normalizeLocalistEvent(allFixtureEvents()[0]);
        if (!base) throw new Error("fixture should normalize");
        return raw === "invalid" ? { ...base, title: "" } : base;
      },
    };
    const run = await processSource(adapter, { now });
    expect(run).toMatchObject({ ok: true, fetched: 3, normalized: 1, skipped: 2 });
  });

  it("skips events that are already past retention", async () => {
    // Several days after the last fixture event.
    const run = await processSource(fixtureAdapter(), { now: () => new Date("2026-10-04T12:00:00Z") });
    expect(run).toMatchObject({ normalized: 0, skipped: 100 });
  });

  it("deduplicates repeated entries from shifting pages", async () => {
    const entry = allFixtureEvents()[0];
    const adapter: SourceAdapter = {
      name: "localist",
      fetch: async () => [entry, entry],
      normalize: normalizeLocalistEvent,
    };
    expect((await processSource(adapter, { now })).normalized).toBe(1);
  });
});
