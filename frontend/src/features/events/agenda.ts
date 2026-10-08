import { parseISO } from "date-fns";
import { TONIGHT_START_HOUR } from "../../constants";
import type { FoodEvent } from "../../types/event";
import { campusDateKey, campusHour, hasEnded } from "../../utils/time";
import { isOnNow } from "./filterEvents";

// The Today page's sections. Each is soonest first; empty ones are hidden.
export interface Agenda {
  happeningNow: FoodEvent[]; // started and not over, plus today's all-day events
  laterToday: FoodEvent[]; // starting later today, before TONIGHT_START_HOUR
  tonight: FoodEvent[]; // starting at TONIGHT_START_HOUR or later
}

const byStart = (a: FoodEvent, b: FoodEvent): number =>
  parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime();

// Splits events into the Today view's sections relative to `now` (campus time).
// Ended events, and events on other days, are left out.
export const buildAgenda = (events: FoodEvent[], now: Date): Agenda => {
  const today = campusDateKey(now);
  const agenda: Agenda = { happeningNow: [], laterToday: [], tonight: [] };

  for (const event of [...events].sort(byStart)) {
    if (hasEnded(event, now)) continue;
    if (isOnNow(event, now)) agenda.happeningNow.push(event);
    else if (event.allDay || campusDateKey(event.startTime) !== today) continue;
    else if (campusHour(event.startTime) >= TONIGHT_START_HOUR) agenda.tonight.push(event);
    else agenda.laterToday.push(event);
  }
  return agenda;
};

export const agendaIsEmpty = (agenda: Agenda): boolean =>
  agenda.happeningNow.length === 0 && agenda.laterToday.length === 0 && agenda.tonight.length === 0;
