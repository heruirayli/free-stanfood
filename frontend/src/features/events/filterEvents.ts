import { LIKELY_THRESHOLD } from "../../constants";
import type { FoodEvent } from "../../types/event";
import { timeOfDay, type TimeOfDay } from "../../utils/time";

export interface EventFilters {
  query: string;
  foodType: string; // "any" or a label from foodDetails, e.g. "pizza"
  timeOfDay: TimeOfDay | "any";
  showLowConfidence: boolean;
}

export const DEFAULT_FILTERS: EventFilters = {
  query: "",
  foodType: "any",
  timeOfDay: "any",
  showLowConfidence: false,
};

export const foodLabels = (event: FoodEvent): string[] =>
  event.foodDetails ? event.foodDetails.split(",").map((label) => label.trim()).filter(Boolean) : [];

// Food types present in the loaded events, most common first.
export const foodTypesIn = (events: FoodEvent[]): string[] => {
  const counts = new Map<string, number>();
  for (const event of events) {
    for (const label of foodLabels(event)) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);
};

// Lowercases, folds curly apostrophes (iOS smart punctuation) into straight ones,
// and drops accents, so "dean's" matches "Dean’s" and "cafe" matches "Café".
const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u02bc\u2032]/g, "'");

const searchableText = (event: FoodEvent): string =>
  normalizeText(
    [event.title, event.description, event.hostOrg, event.locationName, event.foodDetails].filter(Boolean).join(" "),
  );

const matchesQuery = (event: FoodEvent, query: string): boolean => {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = searchableText(event);
  return words.every((word) => text.includes(word));
};

export const isLowConfidence = (event: FoodEvent): boolean => event.foodConfidence < LIKELY_THRESHOLD;

export const applyFilters = (events: FoodEvent[], filters: EventFilters): FoodEvent[] =>
  events.filter(
    (event) =>
      (filters.showLowConfidence || !isLowConfidence(event)) &&
      (filters.foodType === "any" || foodLabels(event).includes(filters.foodType)) &&
      (filters.timeOfDay === "any" || (!event.allDay && timeOfDay(event.startTime) === filters.timeOfDay)) &&
      matchesQuery(event, filters.query),
  );

export const hasActiveFilters = (filters: EventFilters): boolean =>
  filters.query.trim() !== "" ||
  filters.foodType !== DEFAULT_FILTERS.foodType ||
  filters.timeOfDay !== DEFAULT_FILTERS.timeOfDay;
