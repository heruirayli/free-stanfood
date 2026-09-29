import { describe, expect, it } from "vitest";
import { makeClassified, makePublished } from "../../__tests__/factories.js";
import { EMPTY_SNAPSHOT, type EventSnapshot } from "../../models/eventSnapshot.js";
import {
  buildSnapshot,
  dropWeakDailySeries,
  expiresAtFor,
  isPublishable,
  type SourceResult,
} from "../snapshot.js";

const NOW = new Date("2026-09-30T12:00:00Z");
const EARLIER = new Date("2026-09-28T10:00:00Z");

const okResult = (events: SourceResult["events"], source = "localist"): SourceResult => ({
  source,
  ok: true,
  fetched: 1400,
  normalized: 1390,
  events,
});

const previousWith = (...events: EventSnapshot["events"]): EventSnapshot => ({ updatedAt: EARLIER, events });

describe("buildSnapshot", () => {
  it("publishes only public food events, sorted by start time", () => {
    const { snapshot, changed } = buildSnapshot(
      EMPTY_SNAPSHOT,
      [
        okResult([
          makeClassified("later", { startTime: new Date("2026-10-02T19:00:00Z"), endTime: null }),
          makeClassified("sooner"),
          makeClassified("restricted", { audience: "restricted" }),
          makeClassified("no-food", { hasFreeFood: false, foodConfidence: 0 }),
        ]),
      ],
      NOW,
    );
    expect(snapshot.events.map((e) => e.sourceEventId)).toEqual(["sooner", "later"]);
    expect(changed).toBe(true);
    expect(snapshot.updatedAt).toEqual(NOW);
  });

  it("stamps firstSeenAt on new events and keeps it for known ones", () => {
    const { snapshot } = buildSnapshot(
      previousWith(makePublished("known", {}, EARLIER)),
      [okResult([makeClassified("known", { title: "Renamed" }), makeClassified("new")])],
      NOW,
    );
    const byId = Object.fromEntries(snapshot.events.map((e) => [e.sourceEventId, e]));
    expect(byId.known?.firstSeenAt).toEqual(EARLIER);
    expect(byId.known?.title).toBe("Renamed");
    expect(byId.new?.firstSeenAt).toEqual(NOW);
  });

  it("drops events that disappeared from a healthy source", () => {
    const previous = previousWith(...Array.from({ length: 12 }, (_, i) => makePublished(`e${i}`)));
    const fresh = Array.from({ length: 11 }, (_, i) => makeClassified(`e${i}`));
    const { snapshot, reports } = buildSnapshot(previous, [okResult(fresh)], NOW);
    expect(snapshot.events).toHaveLength(11);
    expect(reports[0]).toMatchObject({ published: 11, keptFromPrevious: 0, warnings: [] });
  });

  it("keeps the previous events when a source fails", () => {
    const previous = previousWith(makePublished("a"), makePublished("b"));
    const failed: SourceResult = { source: "localist", ok: false, fetched: 0, normalized: 0, events: [] };
    const { snapshot, reports, changed } = buildSnapshot(previous, [failed], NOW);
    expect(snapshot.events.map((e) => e.sourceEventId)).toEqual(["a", "b"]);
    expect(reports[0]?.keptFromPrevious).toBe(2);
    expect(changed).toBe(false);
    expect(snapshot.updatedAt).toEqual(EARLIER);
  });

  it("keeps previous events alongside new ones when counts look unhealthy", () => {
    const previous = previousWith(...Array.from({ length: 20 }, (_, i) => makePublished(`e${i}`)));
    const { snapshot, reports } = buildSnapshot(previous, [okResult([makeClassified("e0"), makeClassified("new")])], NOW);
    expect(snapshot.events).toHaveLength(21);
    expect(reports[0]?.keptFromPrevious).toBe(19);
    expect(reports[0]?.warnings[0]).toMatch(/dropped 90%/);
    expect(reports[0]?.warnings[1]).toMatch(/kept previously published events/);
  });

  it("drops expired events, including ones kept from a failed source", () => {
    const old = makePublished("old", {
      startTime: new Date("2026-09-28T19:00:00Z"),
      endTime: new Date("2026-09-28T20:00:00Z"),
    });
    const failed: SourceResult = { source: "localist", ok: false, fetched: 0, normalized: 0, events: [] };
    expect(buildSnapshot(previousWith(old), [failed], NOW).snapshot.events).toEqual([]);
  });

  it("drops events from sources that are no longer configured", () => {
    const previous = previousWith(makePublished("x", { source: "retired" }));
    const { snapshot } = buildSnapshot(previous, [okResult([makeClassified("a")])], NOW);
    expect(snapshot.events.map((e) => e.source)).toEqual(["localist"]);
  });

  it("reports no change (and keeps updatedAt) when nothing changed", () => {
    const first = buildSnapshot(EMPTY_SNAPSHOT, [okResult([makeClassified("a"), makeClassified("b")])], EARLIER);
    const second = buildSnapshot(first.snapshot, [okResult([makeClassified("b"), makeClassified("a")])], NOW);
    expect(second.changed).toBe(false);
    expect(second.snapshot.updatedAt).toEqual(EARLIER);
  });
});

describe("dropWeakDailySeries", () => {
  const daily = (count: number, confidence: number, title: string) =>
    Array.from({ length: count }, (_, i) =>
      makeClassified(`${title}-${i}`, {
        title,
        description: "Reception to follow: Oct 1, 5:30pm.",
        foodConfidence: confidence,
        startTime: new Date(Date.UTC(2026, 9, 1 + i, 17)),
      }),
    );

  it("drops weak matches that repeat more often than weekly", () => {
    expect(dropWeakDailySeries(daily(10, 0.3, "Exhibition"))).toEqual([]);
  });

  it("keeps weekly series and strong daily series", () => {
    expect(dropWeakDailySeries(daily(9, 0.3, "Weekly talk"))).toHaveLength(9);
    expect(dropWeakDailySeries(daily(20, 0.9, "Daily breakfast"))).toHaveLength(20);
  });

  it("is applied when building the snapshot", () => {
    const { snapshot } = buildSnapshot(EMPTY_SNAPSHOT, [okResult([...daily(12, 0.3, "Exhibition"), makeClassified("a")])], NOW);
    expect(snapshot.events.map((e) => e.sourceEventId)).toEqual(["a"]);
  });
});

describe("isPublishable", () => {
  it("requires food and a non-restricted audience", () => {
    expect(isPublishable(makeClassified("a"))).toBe(true);
    expect(isPublishable(makeClassified("a", { audience: "rsvp" }))).toBe(true);
    expect(isPublishable(makeClassified("a", { audience: "restricted" }))).toBe(false);
    expect(isPublishable(makeClassified("a", { hasFreeFood: false }))).toBe(false);
  });
});

describe("expiresAtFor", () => {
  it("is 24 hours after the end, or after the start when there is no end", () => {
    expect(expiresAtFor({ startTime: new Date("2026-10-01T19:00:00Z"), endTime: new Date("2026-10-01T20:00:00Z") })).toEqual(
      new Date("2026-10-02T20:00:00Z"),
    );
    expect(expiresAtFor({ startTime: new Date("2026-10-01T19:00:00Z"), endTime: null })).toEqual(
      new Date("2026-10-02T19:00:00Z"),
    );
  });
});
