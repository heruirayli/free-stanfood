import { describe, expect, it } from "vitest";
import { icalSourceName } from "../adapters/ical.js";
import { ICAL_FEEDS } from "../adapters/icalFeeds.js";

describe("ICAL_FEEDS", () => {
  it("gives every feed its own source name", () => {
    const names = ICAL_FEEDS.map(icalSourceName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses https feeds and homepages, and well-formed Luma calendar ids", () => {
    for (const feed of ICAL_FEEDS) {
      expect(feed.url).toMatch(/^https:\/\//);
      expect(feed.homepage).toMatch(/^https:\/\//);
      if (feed.url.includes("api.luma.com")) {
        expect(new URL(feed.url).searchParams.get("id")).toMatch(/^cal-[A-Za-z0-9]{15}$/);
      }
    }
  });
});
