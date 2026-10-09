import { useEffect, useState } from "react";
import eventService from "../features/events/eventService";

// When the listings last changed, once it has loaded. Null until then, and if
// it can't be loaded (the footer just leaves the line out).
export const useLastUpdated = (): Date | null => {
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    eventService
      .getStatus(controller.signal)
      .then((status) => setUpdatedAt(status.updatedAt ? new Date(status.updatedAt) : null))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return updatedAt;
};
