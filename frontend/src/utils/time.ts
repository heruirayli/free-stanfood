import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ASSUMED_DURATION_MS, CAMPUS_TIME_ZONE } from "../constants";
import type { FoodEvent } from "../types/event";

export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening";

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: "Morning (<11 AM)",
  midday: "Midday (11–2)",
  afternoon: "Afternoon (2–5)",
  evening: "Evening (5 PM+)",
};

const toDate = (value: string | Date): Date => (typeof value === "string" ? parseISO(value) : value);

// "2026-09-28" for the campus-time calendar day containing `value`.
export const campusDateKey = (value: string | Date): string =>
  formatInTimeZone(toDate(value), CAMPUS_TIME_ZONE, "yyyy-MM-dd");

// Shifts a "yyyy-MM-dd" key by whole calendar days.
export const addDaysToKey = (key: string, days: number): string =>
  days === 0 ? key : format(addDays(parseISO(key), days), "yyyy-MM-dd");

// Midnight campus time, `offsetDays` days after the campus day containing `now`.
export const startOfCampusDay = (now: Date, offsetDays = 0): Date =>
  fromZonedTime(`${addDaysToKey(campusDateKey(now), offsetDays)}T00:00:00`, CAMPUS_TIME_ZONE);

// Campus wall-clock time with no offset, e.g. "2026-10-01T12:00:00". The calendar
// renders in UTC, so feeding it these shows campus time on any device.
export const toCampusWallClock = (value: string | Date): string =>
  formatInTimeZone(toDate(value), CAMPUS_TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss");

// Inverse of toCampusWallClock: `wallClock`'s UTC fields hold a campus time.
export const fromCampusWallClock = (wallClock: Date): Date =>
  fromZonedTime(wallClock.toISOString().slice(0, 19), CAMPUS_TIME_ZONE);

export const formatTime = (value: string | Date): string =>
  formatInTimeZone(toDate(value), CAMPUS_TIME_ZONE, "h:mm a");

const dayKeyLabel = (key: string, now: Date): string => {
  const today = campusDateKey(now);
  if (key === today) return "Today";
  if (key === addDaysToKey(today, 1)) return "Tomorrow";
  return format(parseISO(key), "EEE, MMM d");
};

export const formatDayLabel = (value: string | Date, now: Date): string => dayKeyLabel(campusDateKey(value), now);

export const formatEventTime = (event: FoodEvent, now: Date): string => {
  const firstDay = campusDateKey(event.startTime);
  const lastDay = lastCampusDateKey(event);
  const day = dayKeyLabel(firstDay, now);
  // Events that span days name the end day too, so the end never reads as before the start.
  const endDay = lastDay === firstDay ? null : dayKeyLabel(lastDay, now);
  if (event.allDay) return endDay ? `${day} – ${endDay} · All day` : `${day} · All day`;
  const start = formatTime(event.startTime);
  if (!event.endTime) return `${day} · ${start}`;
  const end = formatTime(event.endTime);
  return endDay ? `${day} · ${start} – ${endDay} · ${end}` : `${day} · ${start} – ${end}`;
};

export const timeOfDay = (value: string | Date): TimeOfDay => {
  const hour = Number(formatInTimeZone(toDate(value), CAMPUS_TIME_ZONE, "H"));
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 17) return "afternoon";
  return "evening";
};

export const effectiveEnd = (event: FoodEvent): Date =>
  event.endTime
    ? parseISO(event.endTime)
    : new Date(parseISO(event.startTime).getTime() + ASSUMED_DURATION_MS);

export const hasEnded = (event: FoodEvent, now: Date): boolean => effectiveEnd(event) <= now;

// Campus date of the event's last day. The end is exclusive, so an event ending
// at midnight (or an all-day event stored as ending at 23:59) stays on its own day.
export const lastCampusDateKey = (event: FoodEvent): string => {
  const first = campusDateKey(event.startTime);
  const last = campusDateKey(new Date(effectiveEnd(event).getTime() - 1));
  return last < first ? first : last;
};

export const isHappeningNow = (event: FoodEvent, now: Date): boolean =>
  !event.allDay && parseISO(event.startTime) <= now && !hasEnded(event, now);
