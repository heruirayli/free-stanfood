import { describe, expect, it } from "vitest";
import { makeEvent } from "../../../testUtils";
import { agendaIsEmpty, buildAgenda } from "../agenda";

const NOW = new Date("2026-10-01T19:30:00Z"); // Oct 1, 12:30 PM PDT

const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe("buildAgenda", () => {
  const events = [
    makeEvent({ id: "later-2", startTime: "2026-10-01T23:00:00Z", endTime: null }), // 4 PM
    makeEvent({ id: "now", startTime: "2026-10-01T19:00:00Z", endTime: "2026-10-01T20:00:00Z" }),
    makeEvent({ id: "ended", startTime: "2026-10-01T16:00:00Z", endTime: "2026-10-01T17:00:00Z" }),
    makeEvent({ id: "later-1", startTime: "2026-10-01T21:00:00Z", endTime: null }), // 2 PM
    makeEvent({ id: "all-day", startTime: "2026-10-01T07:00:00Z", endTime: "2026-10-02T06:59:00Z", allDay: true }),
    makeEvent({ id: "five", startTime: "2026-10-02T00:00:00Z", endTime: null }), // 5 PM: tonight
    makeEvent({ id: "tomorrow", startTime: "2026-10-02T16:00:00Z", endTime: null }),
    // 11 PM PDT today is already tomorrow in UTC, but it belongs to tonight.
    makeEvent({ id: "late", startTime: "2026-10-02T06:00:00Z", endTime: null }),
    makeEvent({ id: "445", startTime: "2026-10-01T23:45:00Z", endTime: null }), // 4:45 PM: still later today
  ];

  const agenda = buildAgenda(events, NOW);

  it("puts ongoing events, and today's all-day events, under happening now", () => {
    expect(ids(agenda.happeningNow)).toEqual(["all-day", "now"]);
  });

  it("splits the rest of today at 5 PM, soonest first", () => {
    expect(ids(agenda.laterToday)).toEqual(["later-1", "later-2", "445"]);
    expect(ids(agenda.tonight)).toEqual(["five", "late"]);
  });

  it("keeps today's ended events for Earlier Today, and drops other days", () => {
    expect(ids(agenda.earlierToday)).toEqual(["ended"]);
    const all = ids([...agenda.happeningNow, ...agenda.laterToday, ...agenda.tonight, ...agenda.earlierToday]);
    expect(all).not.toContain("tomorrow");
  });

  it("leaves out events that ended before today", () => {
    const yesterday = makeEvent({ id: "yesterday", startTime: "2026-09-30T19:00:00Z", endTime: "2026-09-30T20:00:00Z" });
    // An overnight event that ended this morning counts as today's.
    const overnight = makeEvent({ id: "overnight", startTime: "2026-10-01T05:00:00Z", endTime: "2026-10-01T09:00:00Z" });
    expect(ids(buildAgenda([yesterday, overnight], NOW).earlierToday)).toEqual(["overnight"]);
  });

  it("moves an event to happening now once it starts, and to earlier today once it ends", () => {
    const at = (iso: string) => buildAgenda(events, new Date(iso));
    expect(ids(at("2026-10-01T21:00:00Z").happeningNow)).toContain("later-1");
    const after = at("2026-10-01T22:00:00Z"); // no end listed: an hour
    expect(ids(after.happeningNow)).not.toContain("later-1");
    expect(ids(after.earlierToday)).toContain("later-1");
  });

  it("reports an empty agenda, not counting what's over", () => {
    expect(agendaIsEmpty(buildAgenda([], NOW))).toBe(true);
    expect(agendaIsEmpty(agenda)).toBe(false);
    const onlyOver = buildAgenda([makeEvent({ startTime: "2026-10-01T16:00:00Z", endTime: "2026-10-01T17:00:00Z" })], NOW);
    expect(onlyOver.earlierToday).toHaveLength(1);
    expect(agendaIsEmpty(onlyOver)).toBe(true);
  });

  it("adds tomorrow from 8 PM, but not before", () => {
    const tomorrowLunch = makeEvent({ id: "tomorrow-lunch", startTime: "2026-10-02T19:00:00Z", endTime: null });
    const tomorrowFair = makeEvent({ id: "fair", startTime: "2026-10-02T07:00:00Z", endTime: "2026-10-03T06:59:00Z", allDay: true });
    const dayAfter = makeEvent({ id: "day-after", startTime: "2026-10-03T19:00:00Z", endTime: null });
    const list = [tomorrowLunch, tomorrowFair, dayAfter];
    expect(ids(buildAgenda(list, new Date("2026-10-02T02:59:00Z")).tomorrow)).toEqual([]); // 7:59 PM
    expect(ids(buildAgenda(list, new Date("2026-10-02T03:00:00Z")).tomorrow)).toEqual(["fair", "tomorrow-lunch"]); // 8 PM
  });

  it("doesn't count tomorrow toward today", () => {
    const evening = new Date("2026-10-02T04:00:00Z"); // 9 PM
    const result = buildAgenda([makeEvent({ startTime: "2026-10-02T19:00:00Z", endTime: null })], evening);
    expect(result.tomorrow).toHaveLength(1);
    expect(agendaIsEmpty(result)).toBe(true);
  });

  it("keeps multi-day all-day events on every day they cover", () => {
    const multi = [
      // Sep 30 – Oct 2: mid-run today.
      makeEvent({ id: "mid-run", startTime: "2026-09-30T07:00:00Z", endTime: "2026-10-03T06:59:00Z", allDay: true }),
      // Oct 2 – Oct 3: starts tomorrow.
      makeEvent({ id: "from-tomorrow", startTime: "2026-10-02T07:00:00Z", endTime: "2026-10-04T06:59:00Z", allDay: true }),
    ];
    const result = buildAgenda(multi, NOW);
    expect(ids(result.happeningNow)).toEqual(["mid-run"]);
    expect([...result.laterToday, ...result.tonight]).toEqual([]);
  });

  it("counts a timed event that began yesterday as happening now", () => {
    const hackathon = makeEvent({ id: "hack", startTime: "2026-10-01T01:00:00Z", endTime: "2026-10-02T01:00:00Z" });
    expect(ids(buildAgenda([hackathon], NOW).happeningNow)).toEqual(["hack"]);
  });
});
