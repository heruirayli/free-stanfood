import { describe, expect, it } from "vitest";
import {
  cleanInlineText,
  endOfSourceDay,
  eventId,
  htmlToText,
  isSameTimeNextDay,
  parseCoordinate,
  parseSourceTime,
  resolveEndTime,
} from "../normalize.js";

describe("htmlToText", () => {
  it("strips tags, keeps paragraph breaks, and decodes entities", () => {
    const html = "<p>Join us &amp; friends</p><p>Lunch<br>provided</p><script>alert(1)</script>";
    expect(htmlToText(html)).toBe("Join us & friends\nLunch\nprovided");
  });

  it("separates block elements that plain-text feeds run together", () => {
    expect(htmlToText("<ul><li>breakouts</li><li>A poster session</li></ul>")).toBe(
      "breakouts\nA poster session",
    );
  });

  it("removes zero-width characters and non-breaking spaces", () => {
    expect(htmlToText("<p>​Join us</p>")).toBe("Join us");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToText(null)).toBe("");
    expect(htmlToText("")).toBe("");
  });
});

describe("cleanInlineText", () => {
  it("collapses whitespace onto one line", () => {
    expect(cleanInlineText("Lunch &amp;\n  Learn")).toBe("Lunch & Learn");
  });
});

describe("parseSourceTime", () => {
  it("keeps explicit offsets", () => {
    expect(parseSourceTime("2026-09-28T12:00:00-07:00")?.toISOString()).toBe("2026-09-28T19:00:00.000Z");
    expect(parseSourceTime("2026-09-28T19:00:00Z")?.toISOString()).toBe("2026-09-28T19:00:00.000Z");
  });

  it("interprets local times in America/Los_Angeles across DST changes", () => {
    // DST starts 2026-03-08 and ends 2026-11-01.
    expect(parseSourceTime("2026-03-07T12:00:00")?.toISOString()).toBe("2026-03-07T20:00:00.000Z");
    expect(parseSourceTime("2026-03-09T12:00:00")?.toISOString()).toBe("2026-03-09T19:00:00.000Z");
    expect(parseSourceTime("2026-10-31T12:00")?.toISOString()).toBe("2026-10-31T19:00:00.000Z");
    expect(parseSourceTime("2026-11-02 12:00")?.toISOString()).toBe("2026-11-02T20:00:00.000Z");
  });

  it("treats date-only values as local midnight (all-day events)", () => {
    expect(parseSourceTime("2026-11-01")?.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(parseSourceTime("2026-11-02")?.toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("returns null for missing or unparseable values", () => {
    expect(parseSourceTime(null)).toBeNull();
    expect(parseSourceTime("")).toBeNull();
    expect(parseSourceTime("next tuesday")).toBeNull();
    expect(parseSourceTime("2026-13-45T99:00:00")).toBeNull();
  });
});

describe("endOfSourceDay", () => {
  it("returns 23:59 campus time on the same campus day, across DST", () => {
    // Midnight PDT on Sep 27.
    expect(endOfSourceDay(new Date("2026-09-27T07:00:00Z")).toISOString()).toBe("2026-09-28T06:59:00.000Z");
    // Nov 1 is the fall-back day: it ends in PST.
    expect(endOfSourceDay(new Date("2026-11-01T07:00:00Z")).toISOString()).toBe("2026-11-02T07:59:00.000Z");
    // 23:30 PDT is still the same campus day even though it's the next UTC day.
    expect(endOfSourceDay(new Date("2026-09-28T06:30:00Z")).toISOString()).toBe("2026-09-28T06:59:00.000Z");
  });
});

describe("resolveEndTime", () => {
  const at = (iso: string) => new Date(iso);

  it("drops an end that is the same clock time the next day (a mistyped end date)", () => {
    // Real listing: Thu Nov 5 12:00 PM -> Fri Nov 6 12:00 PM PST.
    expect(resolveEndTime(at("2026-11-05T12:00:00-08:00"), at("2026-11-06T12:00:00-08:00"), false)).toBeNull();
  });

  it("catches the same mistake across the DST change (a 25-hour span)", () => {
    // Sat Oct 31 12:00 PM PDT -> Sun Nov 1 12:00 PM PST.
    const start = at("2026-10-31T12:00:00-07:00");
    const end = at("2026-11-01T12:00:00-08:00");
    expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
    expect(resolveEndTime(start, end, false)).toBeNull();
  });

  it("keeps genuine multi-day and overnight events", () => {
    const conferenceEnd = at("2026-10-02T17:00:00-07:00");
    expect(resolveEndTime(at("2026-10-01T09:00:00-07:00"), conferenceEnd, false)).toEqual(conferenceEnd);
    const overnightEnd = at("2026-10-02T01:00:00-07:00");
    expect(resolveEndTime(at("2026-10-01T22:00:00-07:00"), overnightEnd, false)).toEqual(overnightEnd);
    const nextDayLater = at("2026-10-02T13:00:00-07:00");
    expect(resolveEndTime(at("2026-10-01T12:00:00-07:00"), nextDayLater, false)).toEqual(nextDayLater);
  });

  it("keeps a normal same-day end", () => {
    const end = at("2026-10-01T13:00:00-07:00");
    expect(resolveEndTime(at("2026-10-01T12:00:00-07:00"), end, false)).toEqual(end);
  });

  it("treats a missing or non-positive end as unknown for timed events", () => {
    const start = at("2026-10-01T12:00:00-07:00");
    expect(resolveEndTime(start, null, false)).toBeNull();
    expect(resolveEndTime(start, start, false)).toBeNull();
    expect(resolveEndTime(start, at("2026-10-01T11:00:00-07:00"), false)).toBeNull();
  });

  it("ends all-day events at 23:59 when they have no usable end", () => {
    const start = at("2026-09-27T00:00:00-07:00");
    expect(resolveEndTime(start, null, true)?.toISOString()).toBe("2026-09-28T06:59:00.000Z");
    const listedEnd = at("2026-09-27T23:59:00-07:00");
    expect(resolveEndTime(start, listedEnd, true)).toEqual(listedEnd);
  });
});

describe("isSameTimeNextDay", () => {
  it("compares wall-clock time in campus time", () => {
    expect(isSameTimeNextDay(new Date("2026-11-05T20:00:00Z"), new Date("2026-11-06T20:00:00Z"))).toBe(true);
    expect(isSameTimeNextDay(new Date("2026-11-05T20:00:00Z"), new Date("2026-11-07T20:00:00Z"))).toBe(false);
    expect(isSameTimeNextDay(new Date("2026-11-05T20:00:00Z"), new Date("2026-11-06T21:00:00Z"))).toBe(false);
  });
});

describe("eventId", () => {
  it("is stable and distinct per source", () => {
    expect(eventId("localist", "123")).toBe(eventId("localist", "123"));
    expect(eventId("localist", "123")).not.toBe(eventId("ical", "123"));
    expect(eventId("localist", "123")).toMatch(/^[a-f0-9]{24}$/);
  });
});

describe("parseCoordinate", () => {
  it("parses numeric strings and rejects junk", () => {
    expect(parseCoordinate("37.42816")).toBe(37.42816);
    expect(parseCoordinate(-122.17)).toBe(-122.17);
    expect(parseCoordinate("n/a")).toBeNull();
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate(null)).toBeNull();
  });
});
