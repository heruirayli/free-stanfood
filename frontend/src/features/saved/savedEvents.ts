import { useSyncExternalStore } from "react";
import { ASSUMED_DURATION_MS } from "../../constants";
import type { FoodEvent } from "../../types/event";

// Events the viewer starred, kept in this browser's localStorage: there are no
// accounts. Each is kept with its title and times, so one that's taken down can
// still be named, and ones that are long over drop off on their own.

export interface SavedEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
}

const STORAGE_KEY = "free-stanfood:saved";
// Kept until a day after they end, like the published listings.
const KEEP_AFTER_END_MS = 24 * 60 * 60 * 1000;

const isSavedEvent = (value: unknown): value is SavedEvent => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.startTime === "string" &&
    !Number.isNaN(Date.parse(record.startTime)) &&
    (record.endTime === null || typeof record.endTime === "string")
  );
};

const isOver = (event: SavedEvent, now: number): boolean => {
  const end = event.endTime ? Date.parse(event.endTime) : Date.parse(event.startTime) + ASSUMED_DURATION_MS;
  return end + KEEP_AFTER_END_MS < now;
};

// Storage can be unavailable (private windows, blocked site data) or hold
// anything; either way, start with nothing saved rather than fail.
const readStorage = (): SavedEvent[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isSavedEvent).filter((event) => !isOver(event, Date.now())) : [];
  } catch {
    return [];
  }
};

const writeStorage = (events: SavedEvent[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Saving still works for this visit.
  }
};

let saved: SavedEvent[] = readStorage();
const listeners = new Set<() => void>();

const set = (next: SavedEvent[]): void => {
  saved = next;
  writeStorage(next);
  for (const listener of listeners) listener();
};

// Reads storage again: when another tab changed it, and in tests.
export const reloadSaved = (): void => {
  saved = readStorage();
  for (const listener of listeners) listener();
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) reloadSaved();
  });
}

export const toggleSaved = (event: FoodEvent): void => {
  set(
    saved.some((entry) => entry.id === event.id)
      ? saved.filter((entry) => entry.id !== event.id)
      : [...saved, { id: event.id, title: event.title, startTime: event.startTime, endTime: event.endTime }],
  );
};

export const removeSaved = (ids: ReadonlySet<string>): void => set(saved.filter((entry) => !ids.has(entry.id)));

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

const NONE: SavedEvent[] = [];

// The saved events, in the order they were saved.
export const useSavedEvents = (): SavedEvent[] =>
  useSyncExternalStore(
    subscribe,
    () => saved,
    () => NONE,
  );

export const useIsSaved = (id: string): boolean => useSavedEvents().some((entry) => entry.id === id);
