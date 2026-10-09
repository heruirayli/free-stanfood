import { describe, expect, it } from "vitest";
import { groupFoodTypes } from "../foodGroups";

describe("groupFoodTypes", () => {
  it("sorts food types into kinds, in a fixed order", () => {
    expect(groupFoodTypes(["coffee", "pizza", "dinner", "cookies", "breakfast", "refreshments", "boba"])).toEqual([
      { name: "Meals", types: ["breakfast", "dinner", "pizza"] },
      { name: "Snacks & sweets", types: ["cookies"] },
      { name: "Drinks", types: ["boba", "coffee"] },
      { name: "Other", types: ["refreshments"] },
    ]);
  });

  it("leaves out kinds with nothing in them", () => {
    expect(groupFoodTypes(["lunch"])).toEqual([{ name: "Meals", types: ["lunch"] }]);
    expect(groupFoodTypes([])).toEqual([]);
  });

  it("puts a type it doesn't know under Other, after the known ones", () => {
    expect(groupFoodTypes(["tamales", "reception", "kimchi"])).toEqual([
      { name: "Other", types: ["reception", "kimchi", "tamales"] },
    ]);
  });
});
