import { describe, expect, it } from "vitest";
import { makeEvent } from "../../../testUtils";
import { agendaIsEmpty, buildAgenda } from "../agenda";

const NOW = new Date("2026-10-01T19:30:00Z"); // Oct 1, 12:30 PM PDT

describe("buildAgenda", () => {
  const events = [
    makeEvent({ id: "later-2", startTime: "2026-10-01T23:00:00Z", endTime: null }), // 4 PM
    makeEvent({ id: "now", startTime: "2026-10-01T19:00:00Z", endTime: "2026-10-01T20:00:00Z" }),
    makeEvent({ id: "ended", startTime: "2026-10-01T16:00:00Z", endTime: "2026-10-01T17:00:00Z" }),
    makeEvent({ id: "later-1a", startTime: "2026-10-01T21:00:00Z", endTime: null }), // 2 PM
    makeEvent({ id: "later-1b", startTime: "2026-10-01T21:00:00Z", endTime: null }), // 2 PM
    makeEvent({ id: "all-day", startTime: "2026-10-01T07:00:00Z", endTime: "2026-10-02T06:59:00Z", allDay: true }),
    makeEvent({ id: "tomorrow", startTime: "2026-10-02T16:00:00Z", endTime: null }),
    makeEvent({ id: "next-week", startTime: "2026-10-08T16:00:00Z", endTime: null }),
    // 11 PM PDT today is already tomorrow in UTC, but it belongs to today.
    makeEvent({ id: "late-tonight", startTime: "2026-10-02T06:00:00Z", endTime: null }),
  ];

  const agenda = buildAgenda(events, NOW);

  it("puts ongoing events under happening now", () => {
    expect(agenda.happeningNow.map((e) => e.id)).toEqual(["now"]);
  });

  it("separates all-day events", () => {
    expect(agenda.allDayToday.map((e) => e.id)).toEqual(["all-day"]);
  });

  it("groups later events by start time, soonest first", () => {
    expect(agenda.laterToday.map((g) => [g.label, g.events.map((e) => e.id)])).toEqual([
      ["2:00 PM", ["later-1a", "later-1b"]],
      ["4:00 PM", ["later-2"]],
      ["11:00 PM", ["late-tonight"]],
    ]);
  });

  it("lists tomorrow separately and drops ended and far-off events", () => {
    expect(agenda.tomorrow.map((g) => g.events.map((e) => e.id))).toEqual([["tomorrow"]]);
    const all = [
      ...agenda.happeningNow,
      ...agenda.allDayToday,
      ...agenda.laterToday.flatMap((g) => g.events),
      ...agenda.tomorrow.flatMap((g) => g.events),
    ].map((e) => e.id);
    expect(all).not.toContain("ended");
    expect(all).not.toContain("next-week");
  });

  it("reports an empty agenda", () => {
    expect(agendaIsEmpty(buildAgenda([], NOW))).toBe(true);
    expect(agendaIsEmpty(agenda)).toBe(false);
  });

  it("keeps multi-day all-day events on every day they cover", () => {
    const multi = [
      // Sep 30 – Oct 2: mid-run today.
      makeEvent({ id: "mid-run", startTime: "2026-09-30T07:00:00Z", endTime: "2026-10-03T06:59:00Z", allDay: true }),
      // Oct 2 – Oct 3: starts tomorrow.
      makeEvent({ id: "from-tomorrow", startTime: "2026-10-02T07:00:00Z", endTime: "2026-10-04T06:59:00Z", allDay: true }),
      // Sep 29 – Sep 30: over.
      makeEvent({ id: "over", startTime: "2026-09-29T07:00:00Z", endTime: "2026-10-01T06:59:00Z", allDay: true }),
    ];
    const result = buildAgenda(multi, NOW);
    expect(result.allDayToday.map((e) => e.id)).toEqual(["mid-run"]);
    expect(result.tomorrow.flatMap((g) => g.events.map((e) => e.id))).toEqual(["from-tomorrow"]);
  });
});
