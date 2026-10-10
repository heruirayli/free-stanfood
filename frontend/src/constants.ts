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

// Today's sections: events starting at or after this campus hour are "Tonight".
export const TONIGHT_START_HOUR = 17;

// From this campus hour, Today also shows tomorrow, since little is left of today.
export const TOMORROW_FROM_HOUR = 20;

// Happening-now events this close to their listed end get the "ending soon" look.
export const ENDING_SOON_MS = 30 * 60 * 1000;

// How far ahead the Today page's "Next 2 hours" filter looks.
export const NEXT_HOURS_MS = 2 * 60 * 60 * 1000;

// The iCal feed of upcoming food events (Subscribe, Add to Your Calendar).
export const CALENDAR_FEED_PATH = "/api/events/calendar.ics";

// Downloaded calendar files remind you this long before each event, so you get
// there. The subscription feed has no reminders: it would ping you for everything.
export const REMINDER_MINUTES = 30;

// The static build (GitHub Pages) has no API: events come from a file written at
// build time (data/events.json), and calendar files are made in the browser.
export const STATIC_DATA = import.meta.env.STATIC_DATA === true;
