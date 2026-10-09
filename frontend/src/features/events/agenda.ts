import { parseISO } from "date-fns";
import { TOMORROW_FROM_HOUR, TONIGHT_START_HOUR } from "../../constants";
import type { FoodEvent } from "../../types/event";
import { addDaysToKey, campusDateKey, campusHour, hasEnded, lastCampusDateKey } from "../../utils/time";
import { isOnNow } from "./filterEvents";

// The Today page's sections. Each is soonest first; empty ones are hidden.
export interface Agenda {
  happeningNow: FoodEvent[]; // started and not over, plus today's all-day events
  laterToday: FoodEvent[]; // starting later today, before TONIGHT_START_HOUR
  tonight: FoodEvent[]; // starting at TONIGHT_START_HOUR or later
  tomorrow: FoodEvent[]; // from TOMORROW_FROM_HOUR only: tomorrow's events
  earlierToday: FoodEvent[]; // already over, ending today
}

// In the evening Today looks ahead to tomorrow.
export const showsTomorrow = (now: Date): boolean => campusHour(now) >= TOMORROW_FROM_HOUR;

const byStart = (a: FoodEvent, b: FoodEvent): number =>
  parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime();

// Whether the event takes place on the campus day `day` (all-day events on any of theirs).
const fallsOn = (event: FoodEvent, day: string): boolean =>
  event.allDay
    ? campusDateKey(event.startTime) <= day && day <= lastCampusDateKey(event)
    : campusDateKey(event.startTime) === day;

// Splits events into the Today view's sections relative to `now` (campus time).
// Events on other days, and ones that ended before today, are left out.
export const buildAgenda = (events: FoodEvent[], now: Date): Agenda => {
  const today = campusDateKey(now);
  const tomorrow = showsTomorrow(now) ? addDaysToKey(today, 1) : null;
  const agenda: Agenda = { happeningNow: [], laterToday: [], tonight: [], tomorrow: [], earlierToday: [] };

  for (const event of [...events].sort(byStart)) {
    if (hasEnded(event, now)) {
      if (lastCampusDateKey(event) === today) agenda.earlierToday.push(event);
    } else if (isOnNow(event, now)) agenda.happeningNow.push(event);
    else if (tomorrow && fallsOn(event, tomorrow)) agenda.tomorrow.push(event);
    else if (event.allDay || campusDateKey(event.startTime) !== today) continue;
    else if (campusHour(event.startTime) >= TONIGHT_START_HOUR) agenda.tonight.push(event);
    else agenda.laterToday.push(event);
  }
  return agenda;
};

// Nothing on now or still to come today (tomorrow and events already over don't count).
export const agendaIsEmpty = (agenda: Agenda): boolean =>
  agenda.happeningNow.length === 0 && agenda.laterToday.length === 0 && agenda.tonight.length === 0;
