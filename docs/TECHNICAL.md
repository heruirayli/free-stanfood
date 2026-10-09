# Free Stanfood: Technical Guide

How the app is built and run: setup, the scraping pipeline, sources, the API, and project layout. For an overview, see the [README](../README.md).

The app has three layers that stay separate:

1. **Ingestion**: per-source adapters fetch raw events (`backend/pipeline/adapters/`).
2. **Processing**: normalize into one schema, then classify "has free food" (`backend/pipeline/normalize.ts`, `backend/pipeline/classify/`).
3. **Presentation**: a read-only Express API (`backend/`) and a React frontend (`frontend/`).

There is no database. The pipeline writes the published events to **`data/events.json`**, and a scheduled GitHub Actions workflow commits that file back to the repo. The Express server only reads it.

```
GitHub Actions (daily) ─── npm run pipeline ──> data/events.json ── git commit/push
                                                          │
                                   Express reads it ──────┘ ──> /api/events ──> React app
```

## Requirements

- Node 22.12 or newer (the workflow uses Node 24)

## Setup

```bash
npm install                    # backend + root tooling
npm install --prefix frontend  # frontend
cp .env.example .env           # then fill in the values below
```

### Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `NODE_ENV` | server | `development` or `production`. Production serves the built frontend and hides error stacks. |
| `PORT` | server | Port for Express (default `5000`). |
| `SCRAPER_CONTACT_EMAIL` | pipeline | Sent in the pipeline's User-Agent so source operators can reach you. Required. |
| `HOST_REMOVAL_EMAIL` | frontend (build time) | Address for the "Host? Request removal" link. The link is hidden if this is unset. |

`.env` is gitignored. Never commit keys.

## Running locally

```bash
npm run pipeline   # fetch, normalize, classify, and write data/events.json
npm run dev        # Express on :5000 plus Vite on :5173 (proxies /api to Express)
```

Open http://localhost:5173. The repo already contains a `data/events.json`, so the app has data even before you run the pipeline. The server notices when the file changes, so there's no need to restart after a pipeline run.

| Script | What it does |
|---|---|
| `npm run server` | Express API with nodemon + tsx |
| `npm run client` | Vite dev server for the frontend |
| `npm run dev` | Both of the above together |
| `npm run pipeline` | One pipeline run. Exits non-zero if a source failed or its count looks unhealthy. |
| `npm run build` | Compile the backend to `backend/dist` and build the frontend to `frontend/dist` |
| `npm start` | Run the compiled server (set `NODE_ENV=production` to serve the frontend) |
| `npm test` | Backend and frontend tests (Vitest). No network access needed. |
| `npm run typecheck` | Type-check the backend (including tests) and the frontend |

## Scheduled scraping with GitHub Actions

`.github/workflows/refresh-events.yml` runs the pipeline once a day (12:17 UTC, early morning Pacific) and whenever you trigger it by hand. If `data/events.json` changed, it commits and pushes the file as `github-actions[bot]`. The file is written deterministically, so a run that finds nothing new makes no commit.

One-time setup after pushing the repo to GitHub:

1. **Add the secret.** Go to *Settings → Secrets and variables → Actions → New repository secret* and add `SCRAPER_CONTACT_EMAIL`, a real address a site operator could use to reach you.
2. **Allow the workflow to push.** The workflow requests `contents: write`. If your repo or organization restricts the default token, enable *Settings → Actions → General → Workflow permissions → Read and write permissions*. If `main` has branch protection that blocks direct pushes, allow `github-actions[bot]` to bypass it.
3. **Run it once by hand** from the *Actions* tab (*Refresh events → Run workflow*) and check that it commits.

When a run has problems:

- A source that errors or returns suspicious counts (0 events, or a drop of more than 70%) fails the job, so GitHub emails you. The data from healthy sources is still committed first.
- The failed source keeps its previously published events rather than going blank.
- Raw responses from failed requests are uploaded as a `pipeline-debug-*` artifact on the run.

Things to know:

- GitHub pauses scheduled workflows in public repos after 60 days without activity. The bot's own data commits count as activity.
- Scheduled runs can start a few minutes late when GitHub is busy.
- Anything committed stays in git history. The data is event-level public information only: no attendee names, emails, or RSVP lists.

## The demo on GitHub Pages

The demo at https://heruirayli.github.io/free-stanfood/ is a static build with no server: `.github/workflows/deploy-pages.yml` runs `npm run build:pages` and publishes `frontend/dist`. It deploys on every push to `main` and after each daily *Refresh events* run, so the demo's data is at most a day old.

In that build (`vite build --mode pages`), the app is served from `/free-stanfood/` and does without the API:

- `backend/scripts/exportStatic.ts` writes every published event to `data/events.json` next to the site, and the app filters them in the browser the way `GET /api/events` does (`frontend/src/features/events/staticEvents.ts`).
- The calendar feed is written once per deploy as `calendar.ics`, which is what Subscribe links to.
- "Add to calendar" and the chosen-events download build their `.ics` files in the browser (`features/events/ics.ts`, a copy of `backend/utils/ics.ts`).
- When the listings last changed (shown in the footer) is written as `data/status.json`.
- `404.html` is a copy of `index.html`, so links like `/free-stanfood/week` start the app. GitHub Pages answers them with status 404, but the page works.

One-time setup: *Settings → Pages → Source: GitHub Actions*, and a repository variable `HOST_REMOVAL_EMAIL` (*Settings → Secrets and variables → Actions → Variables*) for the "Host? Request removal" link. To try the static build locally, run `npm run build:pages` and serve `frontend/dist` under `/free-stanfood/`.

### Removing a listing

When a host asks for a listing to come down, add its source URL (the "View original listing" link) to `data/removed.json` and commit it:

```json
{
  "removed": [{ "url": "https://events.stanford.edu/event/example", "note": "Host request, 2026-10-01" }]
}
```

The next pipeline run drops it, every date of a recurring series included, and keeps it out on later runs. To take it down right away, run the pipeline workflow by hand. Removing it from git history as well needs a history rewrite.

## The pipeline

Each run, for every adapter registered in `backend/pipeline/run.ts`:

1. **Fetch** through the polite HTTP client (`pipeline/http.ts`). The client sends a User-Agent with the contact email and makes at most 1 request per second per host. It backs off exponentially on 429/5xx (honoring `Retry-After` for every request to that host), and caps pagination. It sends conditional requests (`If-None-Match`/`If-Modified-Since`) using validators kept in `.cache/http-cache.json`, which GitHub Actions carries between runs.
2. **Normalize** each record into the shared schema (`backend/types/event.ts`). Invalid records are logged and skipped. Private, cancelled, and already-expired events are dropped. An end time at the same clock time the next day (a noon talk listed as ending at noon the next day) is treated as a typo, so the event is kept with no end time.
3. **Classify** food with keyword rules (`pipeline/classify/keywords.ts`). This produces `hasFreeFood`, a `foodConfidence` from 0 to 1, and `foodDetails`. Each food word is judged by the words around it in its own sentence: offers and invitations raise it ("lunch will be provided", "join us at noon for lunch", "dinner from Lotus Thai for the first 50 RSVPs"), while negations, prices, bring-your-own requests, and topic uses cancel it ("pizza won't be provided", "the $25 fee includes lunch", "bring your own lunch", "school lunch standards"). Food at a paid event (a price in the cost field) is not published. `__tests__/keywords.gold.test.ts` checks accuracy floors against 240 real listings in `fixtures/classifier-gold.json`, each labeled by two independent AI annotators with disagreements adjudicated.
4. **Build the snapshot** (`pipeline/snapshot.ts`) and write `data/events.json`:
   - Only food events with a public audience are published. Restricted events are never written, because the file is public.
   - Listings in `data/removed.json` are never published (see [Removing a listing](#removing-a-listing)).
   - `firstSeenAt` carries over from the previous snapshot.
   - Events that vanish from a healthy source are dropped. A failed or unhealthy source keeps its previous events.
   - Events expire 24 hours after they end.
   - Listings that repeat more often than weekly (instances on different days less than a week apart) are skipped unless they explicitly offer food ("Food listed"). These are usually daily exhibitions whose description mentions one dated reception.
   - The same event listed by two sources is published once. Events match when they fall on the same campus day and share the first six title words (titles of one or two words must also start at the same time), and the earlier source in `run.ts` wins (Stanford Events comes first). It wins even when its copy isn't published, so a restricted or no-food Stanford Events listing also keeps its calendar-feed copy off the site.

### Sources

| Source | Method | Notes |
|---|---|---|
| Stanford Events (`events.stanford.edu`) | Public Localist JSON API, `/api/2/events` | Verified 2026-09-28. robots.txt allows `/api/` (`Crawl-Delay: 1`). See the header of `adapters/localist.ts`. |
| Public calendar feeds (`adapters/icalFeeds.ts`) | iCalendar (`.ics`) subscription feeds | 16 public Luma calendars and Stanford Law School's calendar. The Luma calendars belong to Stanford centers and institutes (CEAS, The Europe Center, Precourt, IDA, Ho Center, the Doerr School's Access, Belonging & Community office), found through Luma links in Stanford Events listings, and to student groups (Stanford Founders, Stanford Entrepreneurs, Blockchain Club, Cardinal Ventures, GDG, Biotech Group, Climate Week, IEEE, Stanford XR, BASES), found by web search. Luma feeds carry only the title, address, and host, so for events in the next 60 days the adapter also reads the event's page on `luma.com` for its description and ticket price, from the page's schema.org JSON-LD (one request each, at most 40 per calendar per run). `api.luma.com` disallows only `/insights/` and `luma.com` limits only Googlebot (checked 2026-10-08). The Law School feed is the "Subscribe" link on law.stanford.edu/events; its robots.txt disallows `/events/*` and `/feed` (not the feed's path) and asks for `Crawl-delay: 600`, so it gets one request per run with no retries. Each Law School description ends with who the event is for; community-only and invitation-only events are restricted. |
| CardinalEngage (`cardinalengage.stanford.edu`) | Public RSS feed, `/rss_events` | Only events clubs publish publicly (about two dozen, mostly GSB clubs). Rooms are hidden from signed-out visitors, so cards show no location. The host's "food provided" checkbox counts as an explicit offer. robots.txt (checked 2026-10-06) disallows the mobile app backend (`/mobile_ws/`), which we never use; the event pages need a login, so they aren't scraped either. See the header of `adapters/cardinalengage.ts`. |
| Department websites on Stanford Sites (`adapters/stanfordSites.ts`) | The Drupal platform's public JSON:API, `/jsonapi/node/stanford_event` | ICME, Bing Overseas Studies, Graduate Life Office, AeroAstro, Computer Science, the Center for Teaching and Learning, and Sarafan ChEM-H. Only each site's own events: those copied from Stanford Events (`su_event_localist_id`, `su_event_source`) are skipped. One request per site per run, without retries, since robots.txt asks for `Crawl-delay: 30` (checked 2026-10-08). The request names the fields it needs, so organizer emails and phone numbers are never fetched. A weekly series entered as one span of weeks is skipped. To add a site, add it to `STANFORD_SITES` after checking its robots.txt and that its events aren't all copies. |

New sources should prefer, in order: an official API, a discovered JSON endpoint, iCal/RSS, schema.org JSON-LD, and HTML parsing only as a last resort. Never add a source that requires a login.

#### Adding a calendar feed

Club events that never reach Stanford Events often live on a Luma calendar or a site's own calendar with a "Subscribe" (iCal) link. Either can be added in one line:

1. Find the feed.
   - **Luma:** on the calendar's page, the RSS-shaped **Add iCal Subscription** button offers `webcal://api.luma.com/ics/get?entity=calendar&id=cal-…`. Use it with `https://` instead of `webcal://`.
   - **A site's calendar:** a "Subscribe", "iCal", or "Add to calendar" link on its events page.
   - **Not Google Calendar:** `calendar.google.com/robots.txt` disallows its public `.ics` feeds.
2. Check that the feed needs no login and that the site's robots.txt and terms allow automated access.
3. Add an entry to `ICAL_FEEDS` in `backend/pipeline/adapters/icalFeeds.ts` with an `id`, the host `name`, the feed `url`, and a public `homepage` (for Luma, use the `lumaFeed` helper). Note where you found it and when you checked it. If the site asks for a long crawl delay, set `retries: 0`; if its descriptions state the audience in fixed words, add `audienceRules`.

Each feed runs as its own source (`ical:<id>`), so a broken feed only affects itself, and a calendar with nothing coming up isn't treated as a failure. For Luma calendars, the adapter reads each upcoming event's page for the description the feed leaves out.

### Audience policy

- `open`: listed for "Everyone" or "General Public".
- `rsvp`: has a registration link or asks for an RSVP.
- `unknown`: no clear signal. The UI shows any targeted groups the host listed (e.g. "Intended for: Students").
- `restricted`: the host set a "restricted to" note (e.g. "Current Stanford students and postdocs"), or the title or description limits attendance to Stanford groups ("exclusively for Stanford community members", "Open to all Stanford undergraduates", "STANFORD AFFILIATES ONLY") without also welcoming the public, or a CardinalEngage event has a members-only privacy level. These are **never published**.

### Food confidence

| Band | Confidence | Meaning |
|---|---|---|
| Food listed | ≥ 0.75 | The listing offers the food, e.g. "lunch will be provided", "free pizza", "sessions include lunch", "enjoy some boba" |
| Food likely | 0.45 – 0.75 | A food word without an offer, e.g. "Boba social" |
| Food possible | 0.25 – 0.45 | Weak hints like coffee or "reception to follow". Hidden in the UI by default. |

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/events` | Food events overlapping `[from, to)`. Query: `from`, `to` (ISO dates; default now to a year out), `q`, `minConfidence` (0–1), `audience` (`open`, `rsvp`, `unknown`) |
| GET | `/api/events/calendar.ics` | The same events as an iCalendar file (`free-stanfood.ics`), for importing into Google Calendar (Settings > Import & export) or subscribing by URL once deployed. Same query params, plus `ids` (export only these) or `exclude` (all but these), comma-separated event ids. Leaves out "Food possible" matches unless `minConfidence` is given. The site's Subscribe button shows this URL. The Week and Month pages have a download button with every event selected; people can uncheck the ones they don't want. Each event's details download just that event. |
| GET | `/api/events/status` | `{ updatedAt }`: when the published listings last changed (ISO date, or null). Shown in the site's footer. |
| GET | `/api/events/:id` | A single event |

Invalid query parameters return `400` with `{ message }`.

## Project layout

```
data/events.json       published snapshot (written by the pipeline, committed by Actions)
.github/workflows/     refresh-events.yml: scheduled scrape + commit
backend/
  server.ts            Express entrypoint (listens)
  app.ts               builds the Express app (used by server.ts and the API tests)
  config/paths.ts      locations of data/events.json, data/removed.json and the HTTP cache
  controllers/         route handlers (asyncHandler)
  middleware/          error and 404 handlers
  models/              snapshot file format (eventSnapshot.ts), the server's cached reader (eventStore.ts), and the removal list (removalList.ts)
  routes/              routers
  types/event.ts       Zod schemas, the source of truth for the event shape
  utils/eventFilter.ts filtering for GET /api/events
  pipeline/            standalone ingestion process (never imported by the server)
frontend/
  src/app/             Redux store and typed hooks
  src/features/events/ slices (events and filters, export choices), axios service, filtering and its URL form, agenda grouping
  src/components/      cards, badges, filter chips, event details sheet, header/footer
  src/pages/           Today (default), Week and Month (CalendarPage), an event's own page, About, Contact (request removal), NotFound
  src/types/event.ts   mirrors backend/types/event.ts
```

