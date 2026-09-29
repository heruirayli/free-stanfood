import { describe, expect, it } from "vitest";
import {
  LIKELY_THRESHOLD,
  LISTED_THRESHOLD,
  classifyByKeywords,
  isPaidCost,
  type ClassifierInput,
} from "../classify/keywords.js";

interface Case {
  name: string;
  input: Partial<ClassifierInput>;
  hasFreeFood: boolean;
  minConfidence?: number;
  maxConfidence?: number;
  details?: string | null;
}

const positives: Case[] = [
  { name: "pizza in the title", input: { title: "Pizza and pitch night" }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD, details: "pizza" },
  { name: "explicit free pizza", input: { description: "Free pizza in the lounge after the talk." }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD, details: "pizza" },
  { name: "lunch will be provided", input: { title: "Research seminar", description: "Lunch will be provided." }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD, details: "lunch" },
  { name: "generic food provided", input: { description: "Food provided for all attendees." }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD, details: null },
  { name: "boba social", input: { title: "Boba social" }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD, details: "boba" },
  { name: "snacks and refreshments served", input: { description: "Snacks and refreshments will be served." }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD, details: "snacks, refreshments" },
  { name: "catered dinner", input: { description: "Catered dinner following the talk." }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD, details: "dinner" },
  { name: "light bites", input: { description: "Light bites and drinks in the courtyard." }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD, details: "light bites" },
  { name: "coffee and pastries", input: { title: "Coffee and pastries with the dean" }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD, details: "coffee and pastries" },
  { name: "singular taco", input: { title: "Taco Tuesday" }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD, details: "tacos" },
  { name: "sushi night", input: { title: "Sushi night with the Japanese Student Association" }, hasFreeFood: true, details: "sushi" },
  { name: "several foods", input: { description: "Bagels & donuts in the lobby." }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD, details: "bagels, donuts" },
  { name: "free food exclamation", input: { title: "Study break", description: "Free food!" }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD },
  { name: "breakfast talk", input: { title: "Breakfast at DAAAS with Dr. Simukai Chigudu" }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD, details: "breakfast" },
  { name: "brunch", input: { title: "Brunch with the department chair" }, hasFreeFood: true, details: "brunch" },
  { name: "dessert after a concert", input: { description: "Join us for dessert after the concert." }, hasFreeFood: true, details: "dessert" },
  { name: "topic is food insecurity but lunch is provided", input: { title: "Panel on food insecurity", description: "Lunch will be provided." }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD },
  { name: "burritos served", input: { description: "Burritos will be served at noon." }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD, details: "burritos" },
  { name: "meal provided", input: { description: "A meal provided for all volunteers." }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD },
  { name: "real listing: lunch & learn", input: { title: "Shared Resources at Wu Tsai Neuro & Sarafan ChEM-H: Lunch & Learn" }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD, details: "lunch" },
  { name: "real listing: food and drinks", input: { description: "Join us for food, drinks, and candid conversations." }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD },
  { name: "no RSVP does not cancel the food", input: { description: "No RSVP needed, pizza provided." }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD },
  { name: "lone coffee is low confidence", input: { description: "Networking hour with coffee." }, hasFreeFood: true, maxConfidence: LIKELY_THRESHOLD - 0.01, details: "coffee" },
  { name: "refreshments will be available", input: { description: "Light refreshments will be available for attendees in the library lobby." }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD },
  { name: "a $0 cost is free", input: { description: "Lunch will be provided.", cost: "$0" }, hasFreeFood: true, minConfidence: LISTED_THRESHOLD },
  { name: "reception is a weak signal", input: { description: "Reception to follow." }, hasFreeFood: true, maxConfidence: LIKELY_THRESHOLD - 0.01, details: "reception" },
  { name: "a reception in the title", input: { title: "SDSS Alumni Awards Reception" }, hasFreeFood: true, minConfidence: LIKELY_THRESHOLD, details: "reception" },
];

const negatives: Case[] = [
  { name: "food insecurity panel", input: { title: "Panel on food insecurity" }, hasFreeFood: false },
  { name: "food drive", input: { title: "Food drive", description: "Donate canned goods at the front desk." }, hasFreeFood: false },
  { name: "food pantry giving out free food", input: { title: "Campus food pantry", description: "Free food for students in need." }, hasFreeFood: false },
  { name: "food justice", input: { title: "Food justice teach-in" }, hasFreeFood: false },
  { name: "food policy", input: { title: "Food policy seminar" }, hasFreeFood: false },
  { name: "bring your own lunch", input: { description: "Bring your own lunch and join the discussion." }, hasFreeFood: false },
  { name: "brown bag lunch in title", input: { title: "Brown bag lunch seminar" }, hasFreeFood: false },
  { name: "potluck signup", input: { title: "Potluck dinner", description: "Sign up to bring a dish to share." }, hasFreeFood: false },
  { name: "pizza with a price", input: { description: "Pizza for $5 a slice." }, hasFreeFood: false },
  { name: "dinner tickets", input: { description: "Dinner tickets are $40 per person." }, hasFreeFood: false },
  { name: "food for purchase", input: { description: "Cash bar; appetizers available for purchase." }, hasFreeFood: false },
  { name: "no food allowed", input: { description: "No food, drink, or pen/ink is allowed inside the Center." }, hasFreeFood: false },
  { name: "lunchtime is not lunch", input: { title: "Lunchtime curator talk" }, hasFreeFood: false },
  { name: "snacking is not snacks", input: { title: "Snacking Reinvented", description: "Strategic snacking can help with wellness goals." }, hasFreeFood: false },
  { name: "seafood is not food", input: { title: "Seafood sustainability lecture" }, hasFreeFood: false },
  { name: "virtual event", input: { title: "Lunch & learn", description: "Lunch will be provided.", isVirtual: true }, hasFreeFood: false },
  { name: "paid conference", input: { description: "Breakfast and lunch both days.", cost: "$200 - $800" }, hasFreeFood: false },
  { name: "lunch on your own", input: { description: "Lunch on your own at the nearby cafes." }, hasFreeFood: false },
  { name: "lunch not provided", input: { description: "Please note lunch will not be provided." }, hasFreeFood: false },
  { name: "unrelated event", input: { title: "Autumn Quarter: Add/Drop Deadline", description: "Last day to add or drop courses." }, hasFreeFood: false },
  { name: "reception history is scholarship", input: { description: "A study of the reception history of Coptic art." }, hasFreeFood: false },
  { name: "exhibition day mentioning a dated opening reception", input: { title: "Touch Me Not: Undergraduate Juried Exhibition", description: "Opening Reception: Thursday, Oct. 8, 4–6pm" }, hasFreeFood: false },
  { name: "food not allowed on trails", input: { description: "Food is not allowed on Jasper Ridge trails." }, hasFreeFood: false },
];

const classify = (input: Partial<ClassifierInput>) =>
  classifyByKeywords({ title: "", description: "", ...input });

describe("classifyByKeywords", () => {
  it.each([...positives, ...negatives])("$name", (testCase) => {
    const result = classify(testCase.input);
    expect(result.hasFreeFood).toBe(testCase.hasFreeFood);
    expect(result.classifiedBy).toBe("keywords");
    if (testCase.minConfidence !== undefined) {
      expect(result.foodConfidence).toBeGreaterThanOrEqual(testCase.minConfidence);
    }
    if (testCase.maxConfidence !== undefined) {
      expect(result.foodConfidence).toBeLessThanOrEqual(testCase.maxConfidence);
    }
    if (testCase.details !== undefined) {
      expect(result.foodDetails).toBe(testCase.details);
    }
  });

  it("has at least 25 table cases", () => {
    expect(positives.length + negatives.length).toBeGreaterThanOrEqual(25);
  });

  it("scores explicit phrasing above a bare mention", () => {
    const explicit = classify({ description: "Free pizza for everyone." });
    const bare = classify({ description: "We will talk about pizza ovens." });
    expect(explicit.foodConfidence).toBeGreaterThan(bare.foodConfidence);
  });

  it("keeps confidence within 0..1", () => {
    const result = classify({
      title: "Free pizza, boba, tacos and sushi",
      description: "Catered dinner. Snacks provided. Desserts will be served.",
    });
    expect(result.foodConfidence).toBeGreaterThan(0);
    expect(result.foodConfidence).toBeLessThanOrEqual(1);
  });

  it("returns no details when there is no free food", () => {
    expect(classify({ title: "Panel on food insecurity" }).foodDetails).toBeNull();
  });
});

describe("isPaidCost", () => {
  it.each([
    ["$20", true],
    ["25", true],
    ["$200 - $800", true],
    ["$0", false],
    ["Varies", false],
    ["Free", false],
    ["Free-$300", false],
    ["Free to Current Students — Register", false],
    ["Sold out! Please sign up for the waitlist", false],
    [null, false],
  ])("%s -> %s", (cost, expected) => {
    expect(isPaidCost(cost)).toBe(expected);
  });
});
