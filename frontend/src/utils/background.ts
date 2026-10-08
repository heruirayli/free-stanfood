import type { Location } from "react-router-dom";

// Links to an event's details carry the page they were opened from as
// `background`, so the details open over that page instead of replacing it.
export interface BackgroundState {
  background: Location;
}

const isLocation = (value: unknown): value is Location =>
  typeof value === "object" &&
  value !== null &&
  "pathname" in value &&
  typeof value.pathname === "string" &&
  "search" in value &&
  typeof value.search === "string" &&
  "key" in value &&
  typeof value.key === "string";

// The page an event's details were opened over, if any.
export const backgroundOf = (location: Location): Location | null => {
  const state: unknown = location.state;
  if (typeof state !== "object" || state === null || !("background" in state)) return null;
  return isLocation(state.background) ? state.background : null;
};
