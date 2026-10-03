import { parseISO } from "date-fns";
import type { FoodEvent } from "../../types/event";
import {
  addDaysToKey,
  campusDateKey,
  formatTime,
  hasEnded,
  isHappeningNow,
  lastCampusDateKey,
} from "../../utils/time";

export interface TimeGroup {
  label: string; // e.g. "12:00 PM"
  events: FoodEvent[];
}

export interface Agenda {
  happeningNow: FoodEvent[];
  allDayToday: FoodEvent[];
  laterToday: TimeGroup[];
  tomorrow: TimeGroup[];
}

const byStart = (a: FoodEvent, b: FoodEvent): number =>
  parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime();

// Groups events that share a start time, keeping soonest-first order.
const groupByStartTime = (events: FoodEvent[]): TimeGroup[] => {
  const groups: TimeGroup[] = [];
  for (const event of events) {
    const label = event.allDay ? "All day" : formatTime(event.startTime);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }
  return groups;
};

// Splits events into the Today view's sections relative to `now` (campus time).
export const buildAgenda = (events: FoodEvent[], now: Date): Agenda => {
  const today = campusDateKey(now);
  const tomorrow = addDaysToKey(today, 1);
  const agenda: Agenda = { happeningNow: [], allDayToday: [], laterToday: [], tomorrow: [] };
  const later: FoodEvent[] = [];
  const next: FoodEvent[] = [];

  for (const event of [...events].sort(byStart)) {
    if (hasEnded(event, now)) continue;
    const day = campusDateKey(event.startTime);

    if (event.allDay) {
      // Multi-day all-day events count for every day they cover, not just the first.
      const last = lastCampusDateKey(event);
      if (day <= today && today <= last) agenda.allDayToday.push(event);
      else if (day <= tomorrow && tomorrow <= last) next.push(event);
    } else if (isHappeningNow(event, now)) {
      agenda.happeningNow.push(event);
    } else if (day === today) {
      later.push(event);
    } else if (day === tomorrow) {
      next.push(event);
    }
  }

  agenda.laterToday = groupByStartTime(later);
  // All-day events sort first within tomorrow because they start at midnight.
  agenda.tomorrow = groupByStartTime(next);
  return agenda;
};

export const agendaIsEmpty = (agenda: Agenda): boolean =>
  agenda.happeningNow.length === 0 &&
  agenda.allDayToday.length === 0 &&
  agenda.laterToday.length === 0 &&
  agenda.tomorrow.length === 0;
