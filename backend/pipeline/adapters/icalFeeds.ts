import type { IcalFeed } from "./ical.js";

// Public iCalendar feeds the pipeline reads. Before adding one, confirm that:
// - the feed is offered publicly (no login), e.g. a Luma calendar's
//   "Add iCal Subscription" button or a site's "Subscribe" link;
// - robots.txt allows the feed's path (calendar.google.com's disallows its public
//   .ics feeds, so Google Calendars can't be added this way);
// - the site's terms don't forbid automated access.
// Record where the feed was found and when it was checked.

// Luma: api.luma.com/robots.txt disallows only /insights/ (checked 2026-09-30,
// 2026-10-07, and 2026-10-08). The feed URL is what the calendar page's "Add iCal
// Subscription" button offers signed-out visitors. The feed leaves out each event's
// write-up, so the adapter also reads upcoming events' pages on luma.com, whose
// robots.txt (checked 2026-10-08) limits only Googlebot, on a few other paths.
// Events also listed on Stanford Events are dropped as duplicates when the
// snapshot is built.
const lumaFeed = (id: string, calendarId: string, name: string, homepage: string): IcalFeed => ({
  id,
  name,
  url: `https://api.luma.com/ics/get?entity=calendar&id=${calendarId}`,
  homepage,
  audience: "rsvp",
  eventPages: "luma",
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

  // Found 2026-10-08 by web search and by looking up which calendars host Stanford
  // events' Luma pages. Each is the group's own public calendar, with on-campus
  // events, and its feed loads without a login.
  lumaFeed("luma-ieee-stanford", "cal-LO8vEyiS1bADtaM", "IEEE @ Stanford", "https://luma.com/calendar/cal-LO8vEyiS1bADtaM"),
  lumaFeed("luma-stanford-xr", "cal-NAa8dsOYIC3jJsj", "Stanford XR", "https://luma.com/user/usr-l5wK8M4lPGF1ukq"),
  // BASES's slug names the school year (bases26_27); it may start a new calendar each fall.
  lumaFeed("luma-bases", "cal-ojoAmEYmoppvMZc", "BASES", "https://luma.com/bases26_27"),
  lumaFeed(
    "luma-ho-center",
    "cal-GXz0RHMPNH1JlmG",
    "Ho Center for Buddhist Studies",
    "https://luma.com/user/usr-C3EePdAQqrZCw5a",
  ),
  lumaFeed(
    "luma-doerr-abc",
    "cal-7fLyelEvNknN6eU",
    "Access, Belonging & Community, Doerr School of Sustainability",
    "https://luma.com/user/ABC_Doerr",
  ),

  // Stanford Law School's own calendar (The Events Calendar on WordPress): the
  // "Subscribe" link on law.stanford.edu/events, found 2026-10-08. Almost none of its
  // events are on Stanford Events. robots.txt (checked 2026-10-08) disallows /events/*
  // and /feed and asks for Crawl-delay: 600. The feed is served from
  // /?post_type=tribe_events&ical=1, which those rules don't cover; to respect the
  // crawl delay we make one request per run and never retry. It returns the next 100
  // events (about three weeks). Every description ends with who the event is for.
  {
    id: "stanford-law",
    name: "Stanford Law School",
    url: "https://law.stanford.edu/?post_type=tribe_events&ical=1&eventDisplay=list",
    homepage: "https://law.stanford.edu/events/",
    retries: 0,
    audienceRules: [
      { pattern: /\bStanford Law School community event\b/i, audience: "restricted", note: "Stanford Law School community" },
      { pattern: /\binvitation only event\b/i, audience: "restricted", note: "Invitation only" },
      { pattern: /\bopen to the public\b/i, audience: "open", note: null },
      { pattern: /\bopen to the Stanford community\b/i, audience: "unknown", note: "Stanford community" },
    ],
  },
];
