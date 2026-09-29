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

// Midnight campus time, `offsetDays` days after the campus day containing `now`.
export const startOfCampusDay = (now: Date, offsetDays = 0): Date => {
  const key = campusDateKey(now);
  const shifted = offsetDays === 0 ? key : format(addDays(parseISO(key), offsetDays), "yyyy-MM-dd");
  return fromZonedTime(`${shifted}T00:00:00`, CAMPUS_TIME_ZONE);
};

export const formatTime = (value: string | Date): string =>
  formatInTimeZone(toDate(value), CAMPUS_TIME_ZONE, "h:mm a");

export const formatDayLabel = (value: string | Date, now: Date): string => {
  const key = campusDateKey(value);
  if (key === campusDateKey(now)) return "Today";
  if (key === campusDateKey(startOfCampusDay(now, 1))) return "Tomorrow";
  return formatInTimeZone(toDate(value), CAMPUS_TIME_ZONE, "EEE, MMM d");
};

export const formatEventTime = (event: FoodEvent, now: Date): string => {
  const day = formatDayLabel(event.startTime, now);
  if (event.allDay) return `${day} · All day`;
  const start = formatTime(event.startTime);
  return event.endTime ? `${day} · ${start} – ${formatTime(event.endTime)}` : `${day} · ${start}`;
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

export const isHappeningNow = (event: FoodEvent, now: Date): boolean =>
  !event.allDay && parseISO(event.startTime) <= now && !hasEnded(event, now);
