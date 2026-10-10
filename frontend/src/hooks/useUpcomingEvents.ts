import { useEffect, useState } from "react";
import eventService from "../features/events/eventService";
import type { FoodEvent } from "../types/event";

// How far Today looks for the next free food when nothing is left to show.
const LOOK_AHEAD_MS = 14 * 24 * 60 * 60 * 1000;

// Events in the two weeks from `from` (an ISO date), or null while they load.
// Nothing is fetched while `from` is null. A failed load counts as none: the
// page just shows its usual empty message.
export const useUpcomingEvents = (from: string | null): FoodEvent[] | null => {
  const [loaded, setLoaded] = useState<{ from: string; events: FoodEvent[] } | null>(null);

  useEffect(() => {
    if (!from) return;
    const controller = new AbortController();
    const to = new Date(Date.parse(from) + LOOK_AHEAD_MS).toISOString();
    eventService
      .getEvents({ from, to, minConfidence: 0 }, controller.signal)
      // Only what starts from `from`: the API also returns events still running then.
      .then((events) => setLoaded({ from, events: events.filter((event) => Date.parse(event.startTime) >= Date.parse(from)) }))
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ from, events: [] });
      });
    return () => controller.abort();
  }, [from]);

  return loaded && loaded.from === from ? loaded.events : null;
};
