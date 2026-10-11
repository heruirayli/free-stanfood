import type { EventInput } from "@fullcalendar/core";
import { foodBand } from "../../components/FoodBadge";
import type { FoodEvent } from "../../types/event";
import { describeFood } from "../../utils/food";
import { addDaysToKey, campusDateKey, lastCampusDateKey, toCampusWallClock } from "../../utils/time";

// The calendar runs in UTC and gets campus wall-clock times, so it shows campus
// time on any device without a time zone plugin. All-day events get date-only
// bounds with an exclusive end (the day after their last day), as FullCalendar expects.
export const toCalendarEvent = (event: FoodEvent): EventInput => ({
  id: event.id,
  title: event.title,
  ...(event.allDay
    ? { start: campusDateKey(event.startTime), end: addDaysToKey(lastCampusDateKey(event), 1) }
    : { start: toCampusWallClock(event.startTime), end: event.endTime ? toCampusWallClock(event.endTime) : undefined }),
  allDay: event.allDay,
  classNames: [`food-${foodBand(event.foodConfidence)}`],
  extendedProps: { food: describeFood(event.foodDetails) },
});

// "Now" for the calendar's today highlight and now indicator, in the same form.
export const campusNow = (): string => toCampusWallClock(new Date());

const DAY_MS = 24 * 60 * 60 * 1000;

// The calendar's dates are campus dates at UTC midnight, so UTC fields read them.
const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

// Where Week's back and forward buttons go from a week starting at `start`. It
// opens on today; from there each step lands on a Sunday-to-Saturday week:
// forward to the Sunday after `start` (so no day is skipped), back to the Sunday
// on or before it, or a week before that when `start` is already a Sunday.
export const weekStep = (start: Date, direction: 1 | -1): string => {
  const sunday = start.getTime() - start.getUTCDay() * DAY_MS;
  if (direction === 1) return dateOnly(new Date(sunday + 7 * DAY_MS));
  return dateOnly(new Date(start.getUTCDay() === 0 ? sunday - 7 * DAY_MS : sunday));
};
