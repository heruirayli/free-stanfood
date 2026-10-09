// Kinds of food, for grouping the filter chips: each kind's labels in the order
// they're shown (meals by time of day, then dishes; the rest A–Z). Labels come
// from the classifier (backend/pipeline/classify/keywords.ts). One that isn't
// listed here is shown under Other.
const FOOD_GROUPS: { name: string; labels: string[] }[] = [
  {
    name: "Meals",
    labels: [
      "breakfast",
      "brunch",
      "lunch",
      "dinner",
      "bagels",
      "bbq",
      "burgers",
      "burritos",
      "chick-fil-a",
      "dumplings",
      "in-n-out",
      "noodles",
      "pancakes",
      "panda express",
      "pizza",
      "samosas",
      "sandwiches",
      "sushi",
      "tacos",
    ],
  },
  {
    name: "Snacks & sweets",
    labels: [
      "appetizers",
      "cake",
      "candy",
      "cheese",
      "chocolate",
      "cookies",
      "dessert",
      "donuts",
      "fruit",
      "ice cream",
      "light bites",
      "mochi",
      "mooncakes",
      "pastries",
      "pie",
      "popcorn",
      "snacks",
      "treats",
    ],
  },
  { name: "Drinks", labels: ["boba", "coffee", "coffee and pastries", "happy hour"] },
  { name: "Other", labels: ["reception", "refreshments", "tasting"] },
];

export interface FoodGroup {
  name: string;
  types: string[];
}

// `types` sorted into their kinds, in display order. Kinds with none are left out.
export const groupFoodTypes = (types: string[]): FoodGroup[] => {
  const present = new Set(types);
  const known = new Set(FOOD_GROUPS.flatMap((group) => group.labels));
  const unknown = [...present].filter((type) => !known.has(type)).sort((a, b) => a.localeCompare(b));
  return FOOD_GROUPS.map(({ name, labels }) => ({
    name,
    types: [...labels.filter((label) => present.has(label)), ...(name === "Other" ? unknown : [])],
  })).filter((group) => group.types.length > 0);
};
