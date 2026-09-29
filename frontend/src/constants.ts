export const APP_NAME = "Free Stanfood";

// Event times are shown in campus time no matter where the viewer is.
export const CAMPUS_TIME_ZONE = "America/Los_Angeles";

// Confidence bands. Keep in sync with backend/pipeline/classify/keywords.ts.
export const LIKELY_THRESHOLD = 0.45;
export const LISTED_THRESHOLD = 0.75;

// Matches the backend's assumption for events that list no end time.
export const ASSUMED_DURATION_MS = 60 * 60 * 1000;

// From HOST_REMOVAL_EMAIL in the root .env (exposed by vite.config.ts).
export const HOST_REMOVAL_EMAIL: string | undefined =
  import.meta.env.HOST_REMOVAL_EMAIL?.trim() || undefined;
