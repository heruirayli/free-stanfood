import { describe, expect, it } from "vitest";
import { makeEvent } from "../../../testUtils";
import { describeRepeats, foldSeries } from "../series";

// Wednesdays at 10:30 AM PDT (17:30 UTC).
const spouseCoffee = ["2026-10-14", "2026-10-21", "2026-10-28"].map((day, i) =>
  makeEvent({ id: `coffee-${i}`, title: "International Spouse Coffee", hostOrg: "Bechtel", startTime: `${day}T17:30:00Z`, endTime: null }),
);

describe("foldSeries", () => {
  it("folds a series into its next date, keeping the order", () => {
    const pizza = makeEvent({ id: "pizza", startTime: "2026-10-15T19:00:00Z" });
    const list = [spouseCoffee[0]!, pizza, spouseCoffee[1]!, spouseCoffee[2]!];
    const folded = foldSeries(list);
    expect(folded.map((item) => item.event.id)).toEqual(["coffee-0", "pizza"]);
    expect(folded[0]!.dates.map((e) => e.id)).toEqual(["coffee-0", "coffee-1", "coffee-2"]);
    expect(folded[1]!.dates).toEqual([pizza]);
  });

  it("keeps events with the same title but another host apart", () => {
    const other = makeEvent({ id: "other", title: "International Spouse Coffee", hostOrg: "Haas Center" });
    expect(foldSeries([spouseCoffee[0]!, other])).toHaveLength(2);
  });
});

describe("describeRepeats", () => {
  it("names the weekday and time", () => {
    expect(describeRepeats(spouseCoffee)).toBe("Wednesdays · 10:30 AM · 3 dates");
  });

  it("names two weekdays", () => {
    // Mondays and Wednesdays at 7 PM PDT.
    const meditation = ["2026-10-13", "2026-10-15", "2026-10-20"].map((day) =>
      makeEvent({ title: "Weekly meditation", startTime: `${day}T02:00:00Z` }),
    );
    expect(describeRepeats(meditation)).toBe("Mondays and Wednesdays · 7:00 PM · 3 dates");
  });

  it("only counts the dates when days or times vary", () => {
    const varied = [
      makeEvent({ startTime: "2026-10-14T19:15:00Z" }),
      makeEvent({ startTime: "2026-10-22T20:00:00Z" }),
    ];
    expect(describeRepeats(varied)).toBe("2 dates");
  });

  it("says nothing for a single date", () => {
    expect(describeRepeats([spouseCoffee[0]!])).toBeNull();
  });
});
