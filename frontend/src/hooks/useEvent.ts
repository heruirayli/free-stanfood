import { useEffect, useState } from "react";
import { useAppSelector } from "../app/hooks";
import { errorMessage } from "../features/events/errorMessage";
import eventService from "../features/events/eventService";
import type { FoodEvent } from "../types/event";

interface EventResult {
  event: FoodEvent | null;
  error: string | null;
  retry: () => void;
}

// One event, for its details. Taken from the page underneath when it has it, so
// details opened from a list show at once; fetched otherwise (a shared link).
export const useEvent = (id: string): EventResult => {
  const loaded = useAppSelector((state) => state.events.events.find((event) => event.id === id) ?? null);
  const [fetched, setFetched] = useState<FoodEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inStore = loaded !== null;

  useEffect(() => {
    if (inStore) return;
    const controller = new AbortController();
    setError(null);
    eventService
      .getEvent(id, controller.signal)
      .then(setFetched)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [id, inStore, attempt]);

  const event = loaded ?? (fetched?.id === id ? fetched : null);
  return { event, error: event ? null : error, retry: () => setAttempt((n) => n + 1) };
};
