import { describe, expect, it } from "vitest";
import { assessCounts } from "../health.js";

const counts = (fetched: number, normalized: number, published: number) => ({ fetched, normalized, published });

describe("assessCounts", () => {
  it("is quiet for a normal run", () => {
    expect(assessCounts("localist", counts(1400, 1390, 150), 145)).toEqual([]);
  });

  it("is quiet on the first run", () => {
    expect(assessCounts("localist", counts(1400, 1390, 150), null)).toEqual([]);
  });

  it("warns when the source returns nothing", () => {
    expect(assessCounts("localist", counts(0, 0, 0), 150)).toEqual(["localist: source returned 0 events."]);
  });

  it("warns when nothing normalizes", () => {
    expect(assessCounts("localist", counts(1400, 0, 0), 150)[0]).toMatch(/none normalized/);
  });

  it("warns on a drop of more than 70%", () => {
    expect(assessCounts("localist", counts(1400, 1390, 29), 100)[0]).toMatch(/dropped 71%/);
  });

  it("warns when published events vanish but fetching looks fine", () => {
    expect(assessCounts("localist", counts(1400, 1390, 0), 150)[0]).toMatch(/dropped 100%/);
  });

  it("allows a drop of exactly 70%", () => {
    expect(assessCounts("localist", counts(1400, 1390, 30), 100)).toEqual([]);
  });

  it("lets sources that may be empty report zero events", () => {
    expect(assessCounts("ical:club", counts(0, 0, 0), null, { allowEmpty: true })).toEqual([]);
    expect(assessCounts("ical:club", counts(4, 0, 0), null, { allowEmpty: true })).toEqual([]);
    // A big drop is still reported.
    expect(assessCounts("ical:club", counts(2, 2, 2), 20, { allowEmpty: true })[0]).toMatch(/dropped 90%/);
  });

  it("ignores swings in small sources", () => {
    expect(assessCounts("club-ical", counts(12, 12, 0), 3)).toEqual([]);
  });
});
