import { describe, expect, it } from "vitest";
import {
  cleanInlineText,
  endOfSourceDay,
  eventId,
  htmlToText,
  parseCoordinate,
  parseSourceTime,
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
