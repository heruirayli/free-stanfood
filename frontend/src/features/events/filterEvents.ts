import { parseISO } from "date-fns";
import { LIKELY_THRESHOLD, NEXT_HOURS_MS } from "../../constants";
import type { FoodEvent } from "../../types/event";
import { hasEnded, isAllDayToday, isHappeningNow, timeOfDay, type TimeOfDay } from "../../utils/time";

// The Today page's time filter: everything left today, what's on now, or what's
// on now or starting within two hours.
export type TimeWindow = "today" | "now" | "next2h";

export interface EventFilters {
  query: string;
  openOnly: boolean;
  foodTypes: string[]; // labels from foodDetails, e.g. "pizza"; empty for any food
  window: TimeWindow; // Today page only
  timesOfDay: TimeOfDay[]; // calendar only; empty for any time
  showLowConfidence: boolean;
}

// The page the filters are on. Each shows the shared filters plus its own time filter.
export type FilterScope = "today" | "calendar";

export const DEFAULT_FILTERS: EventFilters = {
  query: "",
  openOnly: false,
  foodTypes: [],
  window: "today",
  timesOfDay: [],
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
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʼ′]/g, "'");

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

// The filters both pages share. Several food types match events with any of them.
export const applyFilters = (events: FoodEvent[], filters: EventFilters): FoodEvent[] =>
  events.filter(
    (event) =>
      (filters.showLowConfidence || !isLowConfidence(event)) &&
      (!filters.openOnly || event.audience === "open") &&
      (filters.foodTypes.length === 0 || foodLabels(event).some((label) => filters.foodTypes.includes(label))) &&
      matchesQuery(event, filters.query),
  );

// On now: started and not over, or an all-day event today.
export const isOnNow = (event: FoodEvent, now: Date): boolean =>
  isHappeningNow(event, now) || isAllDayToday(event, now);

export const matchesWindow = (event: FoodEvent, window: TimeWindow, now: Date): boolean => {
  switch (window) {
    case "today":
      return true;
    case "now":
      return isOnNow(event, now);
    case "next2h":
      return !hasEnded(event, now) && parseISO(event.startTime).getTime() < now.getTime() + NEXT_HOURS_MS;
  }
};

// Several times of day match events in any of them.
export const matchesTimeOfDay = (event: FoodEvent, times: TimeOfDay[]): boolean =>
  times.length === 0 || (!event.allDay && times.includes(timeOfDay(event.startTime)));

// Whether anything narrows the list on this page. The "Food possible" toggle
// doesn't count: it widens the list, and Clear filters leaves it as it is.
export const hasActiveFilters = (filters: EventFilters, scope: FilterScope): boolean =>
  filters.query.trim() !== "" ||
  filters.openOnly ||
  filters.foodTypes.length > 0 ||
  (scope === "today" ? filters.window !== DEFAULT_FILTERS.window : filters.timesOfDay.length > 0);
