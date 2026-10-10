import { formatInTimeZone } from "date-fns-tz";
import { CAMPUS_TIME_ZONE } from "../../constants";
import type { FoodEvent } from "../../types/event";
import { formatTime } from "../../utils/time";

// Repeating events (a weekly coffee hour), folded into one result: the next
// date stands for the series. Same title and host means the same series.

export interface FoldedEvent {
  // The next date of the series (or the event, when it doesn't repeat).
  event: FoodEvent;
  // Every date of the series in the list, soonest first; one when it doesn't repeat.
  dates: FoodEvent[];
}

const seriesKey = (event: FoodEvent): string =>
  `${event.title.trim().toLowerCase()}\u0000${(event.hostOrg ?? "").trim().toLowerCase()}`;

// `events` (soonest first) with each series folded into its next date, in order.
export const foldSeries = (events: FoodEvent[]): FoldedEvent[] => {
  const byKey = new Map<string, FoldedEvent>();
  const folded: FoldedEvent[] = [];
  for (const event of events) {
    const key = seriesKey(event);
    const series = byKey.get(key);
    if (series) {
      series.dates.push(event);
      continue;
    }
    const entry = { event, dates: [event] };
    byKey.set(key, entry);
    folded.push(entry);
  }
  return folded;
};

const WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const weekdayOf = (event: FoodEvent): string => formatInTimeZone(event.startTime, CAMPUS_TIME_ZONE, "EEEE");

const timeOf = (event: FoodEvent): string => (event.allDay ? "All day" : formatTime(event.startTime));

// When a series meets: "Wednesdays · 10:30 AM · 44 dates", "Mondays and Wednesdays ·
// 7:00 PM · 16 dates", or just "13 dates" when its days or times vary. Null for
// a single date.
export const describeRepeats = (dates: FoodEvent[]): string | null => {
  if (dates.length < 2) return null;
  const count = `${dates.length} dates`;
  const times = new Set(dates.map(timeOf));
  const weekdays = [...new Set(dates.map(weekdayOf))].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
  const [time] = times;
  if (times.size !== 1 || !time || weekdays.length > 2) return count;
  return `${weekdays.map((day) => `${day}s`).join(" and ")} · ${time} · ${count}`;
};
