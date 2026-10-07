import type { IcalFeed } from "./ical.js";

// Public iCalendar feeds the pipeline reads. Before adding one, confirm that:
// - the feed is offered publicly (no login), e.g. a Luma calendar's
//   "Add iCal Subscription" button or a Google Calendar's public iCal address;
// - robots.txt allows the feed's path;
// - the site's terms don't forbid automated access.
// Record where the feed was found and when it was checked.

// Luma: api.luma.com/robots.txt disallows only /insights/ (checked 2026-09-30 and
// 2026-10-07). The feed URL is what the calendar page's "Add iCal Subscription"
// button offers signed-out visitors. Events also listed on Stanford Events are
// dropped as duplicates when the snapshot is built.
const lumaFeed = (id: string, calendarId: string, name: string, homepage: string): IcalFeed => ({
  id,
  name,
  url: `https://api.luma.com/ics/get?entity=calendar&id=${calendarId}`,
  homepage,
  audience: "rsvp",
});

export const ICAL_FEEDS: IcalFeed[] = [
  // Found through Luma links in events.stanford.edu listings (2026-09-30).
  lumaFeed("luma-ceas", "cal-O7GXrfpBsgtt7aG", "Stanford Center for East Asian Studies", "https://luma.com/CEAS_SU"),
  lumaFeed("luma-europe-center", "cal-Lmfg1IJGEOc4oZE", "The Europe Center", "https://luma.com/The_Europe_Center"),
  lumaFeed(
    "luma-precourt",
    "cal-jEtxQx1wRXevI4U",
    "Precourt Institute for Energy",
    "https://luma.com/calendar/cal-jEtxQx1wRXevI4U",
  ),

  // Found through a Luma link in an events.stanford.edu listing (2026-10-07). The
  // calendar is the Institute for Diversity in the Arts' own account; every event
  // in it is IDA programming.
  lumaFeed("luma-ida", "cal-04H3vfONPvScuBP", "Institute for Diversity in the Arts", "https://luma.com/user/usr-PA8Ov5Z1r8OdA2H"),

  // Student groups' public Luma calendars, found by web search and checked
  // 2026-10-07: each page is public and its feed loads without a login. Most post
  // events through the year, so a quiet feed between quarters is expected.
  lumaFeed("luma-stanford-founders", "cal-rpbGztlf5pgDfBq", "Stanford Founders", "https://luma.com/stanford-founders-events"),
  lumaFeed("luma-stanford-entrepreneurs", "cal-S62RGN1IuIZH2i6", "Stanford Entrepreneurs", "https://luma.com/stanford-entrepreneurs"),
  lumaFeed("luma-stanford-blockchain", "cal-8cG76po3kxyjrJP", "Stanford Blockchain Club", "https://luma.com/stanfordblockchain"),
  lumaFeed("luma-cardinal-ventures", "cal-jUEn44OiYhMrYBO", "Cardinal Ventures", "https://luma.com/cardinal-ventures"),
  lumaFeed("luma-gdg-stanford", "cal-M6EoxQDvFYwxLtJ", "GDG Stanford", "https://luma.com/calendar/cal-M6EoxQDvFYwxLtJ"),
  lumaFeed("luma-stanford-biotech", "cal-887WFpy0G3Vp8fo", "Stanford Biotech Group", "https://luma.com/calendar/cal-887WFpy0G3Vp8fo"),
  lumaFeed("luma-stanford-climate-week", "cal-EQaBHgwIbY4mqTp", "Stanford Climate Week", "https://luma.com/stanfordclimateweek"),
];
