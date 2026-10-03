import type { EventInput } from "@fullcalendar/core";
import { foodBand } from "../../components/FoodBadge";
import type { FoodEvent } from "../../types/event";
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
});

// "Now" for the calendar's today highlight and now indicator, in the same form.
export const campusNow = (): string => toCampusWallClock(new Date());
