import { useEffect, useState } from "react";

// Current time, refreshed every `intervalMs`, so "happening now" stays accurate.
export const useNow = (intervalMs = 60_000): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
};
