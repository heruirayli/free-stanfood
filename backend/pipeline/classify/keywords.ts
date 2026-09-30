import type { Classification } from "../../types/event.js";

// Stage 1 food classifier: case-insensitive, word-bounded keyword matching over
// title + description, with context rules that raise or cancel each match.

export interface ClassifierInput {
  title: string;
  description: string;
  cost?: string | null;
  isVirtual?: boolean;
}

// Confidence bands. Keep in sync with frontend/src/constants.ts.
export const FOOD_THRESHOLD = 0.25; // at or above: hasFreeFood = true
export const LIKELY_THRESHOLD = 0.45; // "Food likely"; the UI's default minimum
export const LISTED_THRESHOLD = 0.75; // "Food listed"

const MAX_CONFIDENCE = 0.97;
const EXPLICIT_WEIGHT = 0.9;
const TITLE_BONUS = 0.15;
const EXTRA_TERM_BONUS = 0.1;
const PAID_EVENT_FACTOR = 0.4;

interface FoodTerm {
  // Shown to users as foodDetails. null means generic "food".
  label: string | null;
  pattern: string;
  weight: number;
  // Only counts when it appears in the title.
  titleOnly?: boolean;
}

const FOOD_TERMS: FoodTerm[] = [
  {
    label: null,
    pattern:
      "free food|food (?:is |will be )?(?:provided|served)|food will be available|free meals?|meals? (?:is |are |will be )?provided|catered|catering",
    weight: EXPLICIT_WEIGHT,
  },
  { label: null, pattern: "food (?:and|&) (?:drinks?|beverages|refreshments)|food, drinks", weight: 0.55 },
  { label: "coffee and pastries", pattern: "coffee (?:and|&) pastries", weight: 0.55 },
  { label: "pizza", pattern: "pizzas?", weight: 0.5 },
  { label: "boba", pattern: "boba", weight: 0.5 },
  { label: "tacos", pattern: "tacos?", weight: 0.5 },
  { label: "sushi", pattern: "sushi", weight: 0.5 },
  { label: "burritos", pattern: "burritos?", weight: 0.5 },
  { label: "sandwiches", pattern: "sandwich(?:es)?", weight: 0.5 },
  // Restaurant names hosts use in place of the food itself.
  { label: "chick-fil-a", pattern: "chick-?fil-?a", weight: 0.5 },
  { label: "panda express", pattern: "panda express", weight: 0.5 },
  { label: "in-n-out", pattern: "in-?n-?out", weight: 0.5 },
  { label: "donuts", pattern: "donuts?|doughnuts?", weight: 0.5 },
  { label: "bagels", pattern: "bagels?", weight: 0.5 },
  { label: "snacks", pattern: "snacks?", weight: 0.5 },
  { label: "refreshments", pattern: "refreshments?", weight: 0.5 },
  { label: "light bites", pattern: "light bites", weight: 0.5 },
  { label: "appetizers", pattern: "appetizers|hors d['’]?oeuvres", weight: 0.5 },
  { label: "ice cream", pattern: "ice cream", weight: 0.5 },
  { label: "dessert", pattern: "desserts?", weight: 0.45 },
  { label: "cookies", pattern: "cookies", weight: 0.45 },
  { label: "lunch", pattern: "lunch(?:es)?", weight: 0.45 },
  { label: "dinner", pattern: "dinners?", weight: 0.45 },
  { label: "breakfast", pattern: "breakfasts?", weight: 0.45 },
  { label: "brunch", pattern: "brunch(?:es)?", weight: 0.45 },
  { label: "coffee", pattern: "coffee", weight: 0.25 },
  // Campus receptions usually have light food but rarely say so, so they stay weak.
  // In descriptions, only phrasings that describe this event's own reception count.
  // Multi-day exhibitions repeat "Opening Reception: Oct. 1" on every daily listing.
  {
    label: "reception",
    pattern:
      "reception (?:to follow|will follow|follows|following)|followed by (?:a |an )?(?:light |short |brief )?reception|(?:light|short|brief) reception",
    weight: 0.3,
  },
  { label: "reception", pattern: "receptions?", weight: 0.3, titleOnly: true },
  { label: "happy hour", pattern: "happy hour", weight: 0.3 },
];

const TERM_REGEXES = FOOD_TERMS.map((term) => ({
  term,
  regex: new RegExp(`\\b(?:${term.pattern})\\b`, "gi"),
}));

const MEAL_LABELS = new Set(["lunch", "dinner", "breakfast", "brunch"]);

// Words right before a food term that mean it is provided for free.
const STRONG_BEFORE = /\b(?:free|complimentary|catered|provided|served|provid(?:e|es|ing)|serv(?:e|es|ing))\b/i;
// Words right after a food term that mean it is provided. ("Available for
// purchase" never gets here: PRICE_NEARBY cancels the match first.)
const STRONG_AFTER =
  /\b(?:provided|served|included|on us|(?:is|are) (?:free|complimentary)|(?:will be|is|are) available)\b/i;

// Local context that cancels a single match. NEGATING_BEFORE must end right at
// the food word: "no pizza", "bring your own lunch", "pack a lunch", "BYO snacks".
const NEGATING_BEFORE = /(?:^|\s)(?:no|byo|(?:bring|pack)(?: (?:your|a|an))?(?: own)?)$/i;
const NEGATING_AFTER =
  /\b(?:not|won'?t|no longer) (?:be )?(?:provided|served|included|available)\b|\bon your own\b/i;
const PRICE_NEARBY =
  /\$\s?\d|\b\d+(?:\.\d{2})? dollars\b|\bfor (?:purchase|sale)\b|\bpurchas(?:e|ed|ing)\b|\bbuy\b|\bfor a fee\b|\bpay(?:ing)?\b/i;

// Text anywhere in the listing that rules out free food entirely.
const NO_FOOD = /\bno food\b|\bfood (?:and|or|&) drinks? (?:are |is )?not (?:allowed|permitted)\b/i;
// Bring-your-own meal formats cancel meal matches (not e.g. "dessert provided").
const BYO_MEAL = /\bbring (?:your|a) (?:own )?(?:lunch|dinner|breakfast|meal|food)\b|\bbrown[- ]bag\b/i;

// Topics that mention food without serving it, and formats where food isn't free.
const GLOBAL_PENALTIES: { pattern: RegExp; factor: number }[] = [
  {
    pattern: /\bfood (?:drives?|pantr(?:y|ies)|banks?|distribution|donations?|recovery)\b|\bcanned (?:food|goods)\b/i,
    factor: 0.2,
  },
  {
    pattern: /\bfood (?:insecurity|security|justice|polic(?:y|ies)|systems?|sovereignty|access)\b/i,
    factor: 0.7,
  },
  { pattern: /\bpotluck\b/i, factor: 0.3 },
  { pattern: /\bcash bar\b/i, factor: 0.6 },
];

interface Match {
  label: string | null;
  weight: number;
  start: number;
  end: number;
  inTitle: boolean;
}

const SENTENCE_BOUNDARY = /[.!?;\n]/;

const sentenceBefore = (text: string, index: number): string => {
  let start = index;
  while (start > 0 && !SENTENCE_BOUNDARY.test(text[start - 1] ?? "")) start--;
  return text.slice(start, index);
};

const sentenceAfter = (text: string, index: number): string => {
  let end = index;
  while (end < text.length && !SENTENCE_BOUNDARY.test(text[end] ?? "")) end++;
  return text.slice(index, end);
};

const lastWords = (value: string, count: number): string =>
  value.trim().split(/\s+/).slice(-count).join(" ");

const firstWords = (value: string, count: number): string =>
  value.trim().split(/\s+/).slice(0, count).join(" ");

const findMatches = (text: string, titleLength: number): Match[] => {
  const all: Match[] = [];
  for (const { term, regex } of TERM_REGEXES) {
    for (const found of text.matchAll(regex)) {
      const start = found.index;
      if (term.titleOnly && start >= titleLength) continue;
      all.push({
        label: term.label,
        weight: term.weight,
        start,
        end: start + found[0].length,
        inTitle: start < titleLength,
      });
    }
  }
  // Longest match wins where matches overlap ("coffee and pastries" over "coffee").
  all.sort((a, b) => b.end - b.start - (a.end - a.start));
  const kept: Match[] = [];
  for (const match of all) {
    if (!kept.some((k) => match.start < k.end && k.start < match.end)) kept.push(match);
  }
  return kept.sort((a, b) => a.start - b.start);
};

const isCancelledLocally = (text: string, match: Match): boolean => {
  const before = lastWords(sentenceBefore(text, match.start), 3);
  const after = firstWords(sentenceAfter(text, match.end), 6);
  return (
    NEGATING_BEFORE.test(before) ||
    NEGATING_AFTER.test(after) ||
    PRICE_NEARBY.test(before) ||
    PRICE_NEARBY.test(after)
  );
};

const scoreMatch = (text: string, match: Match): number => {
  const before = lastWords(sentenceBefore(text, match.start), 3);
  const after = firstWords(sentenceAfter(text, match.end), 6);
  const strong = STRONG_BEFORE.test(before) || STRONG_AFTER.test(after);
  // "Coffee provided" is a real signal but not a meal: cap weak terms at "likely".
  const strongBase = match.weight >= 0.4 ? EXPLICIT_WEIGHT : LIKELY_THRESHOLD;
  const base = strong ? Math.max(match.weight, strongBase) : match.weight;
  return base + (match.inTitle ? TITLE_BONUS : 0);
};

// True when the listed cost names a non-zero amount and doesn't say "free".
export const isPaidCost = (cost: string | null | undefined): boolean => {
  if (!cost) return false;
  if (/\bfree\b/i.test(cost)) return false;
  const amounts = cost.match(/\d+(?:\.\d+)?/g) ?? [];
  return amounts.some((amount) => Number(amount) > 0);
};

const noFood = (): Classification => ({
  hasFreeFood: false,
  foodConfidence: 0,
  foodDetails: null,
  classifiedBy: "keywords",
});

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const classifyByKeywords = (input: ClassifierInput): Classification => {
  if (input.isVirtual) return noFood();

  const title = input.title.trim();
  const text = `${title}\n${input.description.trim()}`;
  if (NO_FOOD.test(text)) return noFood();

  const byoMeal = BYO_MEAL.test(text);
  const matches = findMatches(text, title.length).filter(
    (match) =>
      !isCancelledLocally(text, match) && !(byoMeal && match.label && MEAL_LABELS.has(match.label)),
  );
  if (matches.length === 0) return noFood();

  const distinctLabels = new Set(matches.map((match) => match.label ?? "food"));
  let confidence =
    Math.max(...matches.map((match) => scoreMatch(text, match))) +
    EXTRA_TERM_BONUS * (distinctLabels.size - 1);

  for (const { pattern, factor } of GLOBAL_PENALTIES) {
    if (pattern.test(text)) confidence *= factor;
  }
  if (isPaidCost(input.cost)) confidence *= PAID_EVENT_FACTOR;

  confidence = round2(Math.min(MAX_CONFIDENCE, Math.max(0, confidence)));
  const hasFreeFood = confidence >= FOOD_THRESHOLD;
  const details = [...new Set(matches.flatMap((match) => (match.label ? [match.label] : [])))];

  return {
    hasFreeFood,
    foodConfidence: confidence,
    foodDetails: hasFreeFood && details.length > 0 ? details.join(", ") : null,
    classifiedBy: "keywords",
  };
};
