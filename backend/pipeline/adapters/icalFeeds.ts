import type { IcalFeed } from "./ical.js";

// Public iCalendar feeds the pipeline reads. Before adding one, confirm that:
// - the feed is offered publicly (no login), e.g. a Luma calendar's
//   "Add iCal Subscription" button or a Google Calendar's public iCal address;
// - robots.txt allows the feed's path;
// - the site's terms don't forbid automated access.
// Record where the feed was found and when it was checked.

// Luma: api.luma.com/robots.txt disallows only /insights/ (checked 2026-09-30).
// The feed URL is what the calendar page's "Add iCal Subscription" button offers
// signed-out visitors. These three were found through Luma links in
// events.stanford.edu listings, so most of their events are already on Stanford
// Events; duplicates are dropped when the snapshot is built.
const lumaFeed = (id: string, calendarId: string, name: string, homepage: string): IcalFeed => ({
  id,
  name,
  url: `https://api.luma.com/ics/get?entity=calendar&id=${calendarId}`,
  homepage,
  audience: "rsvp",
});

export const ICAL_FEEDS: IcalFeed[] = [
  lumaFeed("luma-ceas", "cal-O7GXrfpBsgtt7aG", "Stanford Center for East Asian Studies", "https://luma.com/CEAS_SU"),
  lumaFeed("luma-europe-center", "cal-Lmfg1IJGEOc4oZE", "The Europe Center", "https://luma.com/The_Europe_Center"),
  lumaFeed(
    "luma-precourt",
    "cal-jEtxQx1wRXevI4U",
    "Precourt Institute for Energy",
    "https://luma.com/calendar/cal-jEtxQx1wRXevI4U",
  ),
];
