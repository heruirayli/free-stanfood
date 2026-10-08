import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ASSUMED_DURATION_MS, CAMPUS_TIME_ZONE, ENDING_SOON_MS } from "../constants";
import type { FoodEvent } from "../types/event";

export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening";

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  evening: "Evening",
};

// The hours each label covers, for screen readers and tooltips.
export const TIME_OF_DAY_HOURS: Record<TimeOfDay, string> = {
  morning: "before 11 AM",
  midday: "11 AM to 2 PM",
  afternoon: "2 to 5 PM",
  evening: "5 PM and later",
};

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const toDate = (value: string | Date): Date => (typeof value === "string" ? parseISO(value) : value);

// Hour of the day (0–23) in campus time.
export const campusHour = (value: string | Date): number =>
  Number(formatInTimeZone(toDate(value), CAMPUS_TIME_ZONE, "H"));

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

// The time on a Today card, where the day goes without saying: "12:00 PM – 1:00 PM",
// or "All day". Events on other days, or running past today, name their days.
export const formatTimeRange = (event: FoodEvent, now: Date): string => {
  const day = campusDateKey(event.startTime);
  if (day !== campusDateKey(now) || lastCampusDateKey(event) !== day) return formatEventTime(event, now);
  if (event.allDay) return "All day";
  const start = formatTime(event.startTime);
  return event.endTime ? `${start} – ${formatTime(event.endTime)}` : start;
};

// "40 min", "1 hr 5 min", "2 hr".
export const formatDuration = (ms: number): string => {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
};

export interface RelativeTime {
  label: string;
  // Within ENDING_SOON_MS of a listed end. Events with no end time never are,
  // since when they end is a guess.
  endingSoon: boolean;
}

// When the event is relative to now: "Starts in 40 min", "Started 15 min ago",
// "Ends in 20 min". Null for all-day events and for events a day or more away,
// where the date says enough.
export const relativeTime = (event: FoodEvent, now: Date): RelativeTime | null => {
  if (event.allDay) return null;
  const until = parseISO(event.startTime).getTime() - now.getTime();
  if (until > 0) return until < DAY_MS ? { label: `Starts in ${formatDuration(until)}`, endingSoon: false } : null;
  if (hasEnded(event, now)) return { label: "Ended", endingSoon: false };
  if (event.endTime) {
    const left = parseISO(event.endTime).getTime() - now.getTime();
    if (left <= ENDING_SOON_MS) return { label: `Ends in ${formatDuration(left)}`, endingSoon: true };
  }
  const elapsed = -until;
  if (elapsed < MINUTE_MS) return { label: "Just started", endingSoon: false };
  if (elapsed >= DAY_MS) return { label: "Happening now", endingSoon: false };
  return { label: `Started ${formatDuration(elapsed)} ago`, endingSoon: false };
};

export const timeOfDay = (value: string | Date): TimeOfDay => {
  const hour = campusHour(value);
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

// All-day events whose days include today (campus time).
export const isAllDayToday = (event: FoodEvent, now: Date): boolean => {
  const today = campusDateKey(now);
  return event.allDay && campusDateKey(event.startTime) <= today && today <= lastCampusDateKey(event);
};
