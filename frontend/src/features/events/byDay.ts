import type { FoodEvent } from "../../types/event";
import { campusDateKey } from "../../utils/time";

export interface Day {
  key: string; // campus date, "yyyy-MM-dd"
  events: FoodEvent[];
}

// Events by campus day, soonest first (for lists that span days: search
// results, saved events). Events that started on an earlier day and are still
// on count as today's.
export const byDay = (events: FoodEvent[], now: Date): Day[] => {
  const today = campusDateKey(now);
  const days = new Map<string, FoodEvent[]>();
  for (const event of events) {
    const start = campusDateKey(event.startTime);
    const key = start < today ? today : start;
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return [...days].map(([key, list]) => ({ key, events: list })).sort((a, b) => a.key.localeCompare(b.key));
};
