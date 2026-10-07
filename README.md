# Free Stanfood

**Find free food on the Stanford campus.** Free Stanfood gathers public events from across campus every morning and shows the ones with free food: what's happening right now, what's later today, and what's coming up over the next year.

<!-- Screenshots go here. Suggested: the Today page and an event's details on a phone, and the month calendar on a desktop. Put the images in docs/screenshots/ and add them like:
<img src="docs/screenshots/today-mobile.png" alt="The Today page on a phone" width="260" />
-->

## Why

Campus is full of free food: lunch at a seminar, pizza at a club meeting, boba at an open house. But it's scattered across several event sites, buried in long descriptions, and easy to miss. Free Stanfood reads those listings for you and puts the food in one place.

## What You Can Do

- **See what's free today.** The Today page shows what's happening now, later today, and tomorrow, soonest first.
- **Browse the calendar.** Month, week, and list views of everything with food, up to a year ahead.
- **Know what to expect.** Every event says what food there is, how sure the listing is ("Food listed", "Food likely", "Food possible"), and who can come.
- **Filter.** By food, by time of day, or by searching for "pizza", a building, or a host.
- **Add events to your calendar.** Download a calendar file for Google Calendar, Apple Calendar, or Outlook. Everything is included by default; drop single events or whole days.
- **Use it on your phone.** Designed for small screens first, and usable by keyboard and screen reader.

## How It Works

```
 Stanford Events ─┐
 CardinalEngage ──┼──▶  daily scrape  ──▶  find the free food  ──▶  events.json  ──▶  website
 Luma calendars ──┘    (GitHub Actions)      (rule-based)          (in the repo)
```

1. **Collect.** Every morning a GitHub Actions job reads the public listings on [Stanford Events](https://events.stanford.edu), student-group events on [CardinalEngage](https://cardinalengage.stanford.edu), and public Luma calendars of Stanford centers and clubs.
2. **Read for food.** Each listing is checked sentence by sentence. "Lunch will be provided" and "join us for pizza" count; "food insecurity panel", "bring your own lunch", "$25 includes dinner", and "pizza won't be provided" don't.
3. **Publish.** The results are saved to a single data file in the repo, and the site reads it. There's no database to run.

## Highlights

- **Accurate, with no AI model.** The food detector is plain rules, so it costs nothing to run and every decision can be explained and fixed. It's tested against 240 real campus listings, each labeled independently twice with disagreements reviewed. On listings it had never seen, it found every free-food event and marked 9 in 10 as "Food listed" (up from about half), without a single wrong "Food listed".
- **A polite scraper.** It reads only public pages, never anything behind a login, and follows each site's robots.txt. It sends at most one request a second, backs off when a site is busy, and skips downloads that haven't changed.
- **Privacy first.** Only details about the event are kept, never who's attending. Private and members-only events are left out, and hosts can ask for a listing to be removed.
- **Careful with time.** Times are always shown in campus time, whatever the viewer's time zone, including all-day and multi-day events and daylight saving changes.
- **Well tested.** About 370 automated tests cover the scraper, the food detector, the API, and the interface, using saved real data instead of live sites.

## Built With

TypeScript throughout. React 19, Redux Toolkit, Tailwind CSS, Motion, and FullCalendar on the front end. Node, Express 5, and Zod on the back end. Vitest and Testing Library for tests. GitHub Actions runs the daily scrape.

## Run It Locally

You need Node 22.12 or newer.

```bash
npm install && npm install --prefix frontend
cp .env.example .env   # add a contact email for the scraper
npm run dev            # then open http://localhost:5173
```

The repo includes recent data, so the site works right away. Run `npm run pipeline` to fetch fresh listings, and `npm test` to run the tests.

## Learn More

The [technical guide](docs/TECHNICAL.md) covers setup and environment variables, the scraping pipeline and its sources, the food rules, the API, the GitHub Actions schedule, and how to remove a listing.
