import { TIME_OF_DAY_LABELS, type TimeOfDay } from "../../utils/time";
import { DEFAULT_FILTERS, type EventFilters, type FilterScope, type TimeWindow } from "./filterEvents";

// The filters in the address bar, so a filtered view can be shared, bookmarked,
// or reloaded: ?q=pizza&open=1&food=pizza,boba&possible=1, plus the page's own
// time filter (when=now or when=2h on Today, time=evening on the calendar).
// Defaults are left out, so an unfiltered page has a clean URL.

const WINDOW_PARAMS = new Map<TimeWindow, string>([
  ["now", "now"],
  ["next2h", "2h"],
]);
const WINDOWS = new Map([...WINDOW_PARAMS].map(([window, param]) => [param, window]));

const isTimeOfDay = (value: string): value is TimeOfDay => Object.hasOwn(TIME_OF_DAY_LABELS, value);

export const filtersToParams = (filters: EventFilters, scope: FilterScope): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query);
  if (filters.openOnly) params.set("open", "1");
  if (filters.foodTypes.length > 0) params.set("food", filters.foodTypes.join(","));
  if (filters.showLowConfidence) params.set("possible", "1");
  if (scope === "today") {
    const when = WINDOW_PARAMS.get(filters.window);
    if (when) params.set("when", when);
  } else if (filters.timeOfDay !== "any") {
    params.set("time", filters.timeOfDay);
  }
  return params;
};

// Every filter a page's URL controls, with the default for any it leaves out.
// Unknown values are ignored.
export const filtersFromParams = (params: URLSearchParams, scope: FilterScope): Partial<EventFilters> => {
  const food = params.get("food") ?? "";
  const shared: Partial<EventFilters> = {
    query: params.get("q") ?? "",
    openOnly: params.get("open") === "1",
    foodTypes: [...new Set(food.split(",").map((label) => label.trim().toLowerCase()).filter(Boolean))],
    showLowConfidence: params.get("possible") === "1",
  };
  if (scope === "today") return { ...shared, window: WINDOWS.get(params.get("when") ?? "") ?? DEFAULT_FILTERS.window };
  const time = params.get("time") ?? "";
  return { ...shared, timeOfDay: isTimeOfDay(time) ? time : DEFAULT_FILTERS.timeOfDay };
};

// The shared filters as a query string ("" or "?food=pizza"), for links between
// pages, so switching views keeps them.
export const sharedFilterSearch = (filters: EventFilters): string => {
  const params = filtersToParams({ ...filters, window: DEFAULT_FILTERS.window }, "today").toString();
  return params ? `?${params}` : "";
};
