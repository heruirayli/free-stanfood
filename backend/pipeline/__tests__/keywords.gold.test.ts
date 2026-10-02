import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FOOD_THRESHOLD, LIKELY_THRESHOLD, LISTED_THRESHOLD, classifyByKeywords } from "../classify/keywords.js";
import { readFixture } from "./helpers.js";

// Accuracy floors on real listings, so a rule that helps one case can't quietly
// break others. Current scores are at or near 100%; the floors leave a little room.

const goldSchema = z.object({
  listings: z.array(
    z.object({
      id: z.string(),
      label: z.enum(["free_food", "drinks_only", "implied", "no_free_food"]),
      title: z.string(),
      description: z.string(),
      cost: z.string().nullable(),
      isVirtual: z.boolean(),
    }),
  ),
});

const { listings } = goldSchema.parse(JSON.parse(readFixture("classifier-gold.json")));
const scored = listings.map((listing) => ({ ...listing, confidence: classifyByKeywords(listing).foodConfidence }));
const withLabel = (label: string) => scored.filter((listing) => listing.label === label);
const share = (list: typeof scored, test: (confidence: number) => boolean) =>
  list.filter((listing) => test(listing.confidence)).length / list.length;
const idsOf = (list: typeof scored) => list.map((listing) => `${listing.id} ${listing.title}`);

describe("classifyByKeywords on labeled real listings", () => {
  const free = withLabel("free_food");
  const none = withLabel("no_free_food");
  const gray = [...withLabel("implied"), ...withLabel("drinks_only")];

  it("has a meaningful sample", () => {
    expect(free.length).toBeGreaterThanOrEqual(50);
    expect(none.length).toBeGreaterThanOrEqual(100);
  });

  it("shows nearly every free-food listing by default", () => {
    expect(share(free, (c) => c >= LIKELY_THRESHOLD)).toBeGreaterThanOrEqual(0.95);
  });

  it("marks most free-food listings 'Food listed'", () => {
    expect(share(free, (c) => c >= LISTED_THRESHOLD)).toBeGreaterThanOrEqual(0.9);
  });

  it("publishes almost no listings without free food", () => {
    expect(idsOf(none.filter((listing) => listing.confidence >= FOOD_THRESHOLD)).length).toBeLessThanOrEqual(2);
  });

  it("keeps 'Food listed' for listings that say food is provided", () => {
    expect(idsOf([...none, ...gray].filter((listing) => listing.confidence >= LISTED_THRESHOLD))).toEqual([]);
  });
});
