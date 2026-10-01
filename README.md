# Free Stanfood

A mobile-first calendar of free food at public events on the Stanford campus. It is built from public event listings and refreshed automatically by GitHub Actions.

The app has three layers that stay separate:

1. **Ingestion**: per-source adapters fetch raw events (`backend/pipeline/adapters/`).
2. **Processing**: normalize into one schema, then classify "has free food" (`backend/pipeline/normalize.ts`, `backend/pipeline/classify/`).
3. **Presentation**: a read-only Express API (`backend/`) and a React frontend (`frontend/`).

There is no database. The pipeline writes the published events to **`data/events.json`**, and a scheduled GitHub Actions workflow commits that file back to the repo. The Express server only reads it.

```
GitHub Actions (every 12h) ─ npm run pipeline ──> data/events.json ── git commit/push
                                                          │
                                   Express reads it ──────┘ ──> /api/events ──> React app
```

## Requirements

- Node 20 or newer (the workflow uses Node 24)

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
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | pipeline (Phase 4) | LLM classification of borderline events. Not used yet. |

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

`.github/workflows/refresh-events.yml` runs the pipeline twice a day (00:17 and 12:17 UTC) and whenever you trigger it by hand. If `data/events.json` changed, it commits and pushes the file as `github-actions[bot]`. The file is written deterministically, so a run that finds nothing new makes no commit.

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
- Anything committed stays in git history. A host removal request means removing the event going forward, and rewriting history if you need it gone entirely. The data is event-level public information only: no attendee names, emails, or RSVP lists.

## The pipeline

Each run, for every adapter registered in `backend/pipeline/run.ts`:

1. **Fetch** through the polite HTTP client (`pipeline/http.ts`). The client sends a User-Agent with the contact email and makes at most 1 request per second per host. It backs off exponentially on 429/5xx (honoring `Retry-After`), sends conditional requests, and caps pagination.
2. **Normalize** each record into the shared schema (`backend/types/event.ts`). Invalid records are logged and skipped. Private, cancelled, and already-expired events are dropped. An end time at the same clock time the next day (a noon talk listed as ending at noon the next day) is treated as a typo, so the event is kept with no end time.
3. **Classify** food with keyword rules (`pipeline/classify/keywords.ts`). This produces `hasFreeFood`, a `foodConfidence` from 0 to 1, and `foodDetails`.
4. **Build the snapshot** (`pipeline/snapshot.ts`) and write `data/events.json`:
   - Only food events with a public audience are published. Restricted events are never written, because the file is public.
   - `firstSeenAt` carries over from the previous snapshot.
   - Events that vanish from a healthy source are dropped. A failed or unhealthy source keeps its previous events.
   - Events expire 24 hours after they end.
   - Weak matches ("Food possible") on listings that repeat more often than weekly are skipped. These are usually daily exhibitions whose description mentions one dated reception.
   - The same event listed by two sources is published once. Events match when they fall on the same campus day and share the first six title words, and the earlier source in `run.ts` wins (Stanford Events comes first).

### Sources

| Source | Method | Notes |
|---|---|---|
| Stanford Events (`events.stanford.edu`) | Public Localist JSON API, `/api/2/events` | Verified 2026-09-28. robots.txt allows `/api/` (`Crawl-Delay: 1`). See the header of `adapters/localist.ts`. |
| Public calendar feeds (`adapters/icalFeeds.ts`) | iCalendar (`.ics`) subscription feeds | Currently three Luma calendars of Stanford centers, found through Luma links in Stanford Events listings. `api.luma.com` allows `/ics/get` in robots.txt (checked 2026-09-30). Most of their events are already on Stanford Events, so today they add few or none. |

New sources should prefer, in order: an official API, a discovered JSON endpoint, iCal/RSS, schema.org JSON-LD, and HTML parsing only as a last resort. Never add a source that requires a login.

#### Adding a calendar feed

Club events that never reach Stanford Events often live on a public Google Calendar or a Luma calendar. Both publish an iCal feed you can add in one line:

1. Find the feed.
   - **Luma:** on the calendar's page, the RSS-shaped **Add iCal Subscription** button offers `webcal://api.luma.com/ics/get?entity=calendar&id=cal-…`. Use it with `https://` instead of `webcal://`.
   - **Google Calendar:** in the calendar's settings, **Public address in iCal format**, which ends in `/public/basic.ics`. It only works if the calendar is public.
2. Check that the feed needs no login and that the site's robots.txt and terms allow automated access.
3. Add an entry to `ICAL_FEEDS` in `backend/pipeline/adapters/icalFeeds.ts` with an `id`, the host `name`, the feed `url`, and a public `homepage`. Note where you found it and when you checked it.

Each feed runs as its own source (`ical:<id>`), so a broken feed only affects itself, and a calendar with nothing coming up isn't treated as a failure. One limitation: Luma feeds carry only the title, address, and host, not the event's full description, so food detection there mostly relies on the title.

### Audience policy

- `open`: listed for "Everyone" or "General Public".
- `rsvp`: has a registration link or asks for an RSVP.
- `unknown`: no clear signal. The UI shows any targeted groups the host listed (e.g. "Intended for: Students").
- `restricted`: the host set a "restricted to" note (e.g. "Current Stanford students and postdocs"). These are **never published**.

### Food confidence

| Band | Confidence | Meaning |
|---|---|---|
| Food listed | ≥ 0.75 | Explicit wording, e.g. "lunch will be provided", "free pizza" |
| Food likely | 0.45 – 0.75 | A food word without "provided", e.g. "Boba social" |
| Food possible | 0.25 – 0.45 | Weak hints like coffee or "reception to follow". Hidden in the UI by default. |

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/events` | Food events overlapping `[from, to)`. Query: `from`, `to` (ISO dates; default now to 8 weeks out), `q`, `minConfidence` (0–1), `audience` (`open`, `rsvp`, `unknown`) |
| GET | `/api/events/:id` | A single event |

Invalid query parameters return `400` with `{ message }`.

## Project layout

```
data/events.json       published snapshot (written by the pipeline, committed by Actions)
.github/workflows/     refresh-events.yml: scheduled scrape + commit
backend/
  server.ts            Express entrypoint
  config/paths.ts      location of data/events.json
  controllers/         route handlers (asyncHandler)
  middleware/          error and 404 handlers
  models/              snapshot file format (eventSnapshot.ts) and the server's cached reader (eventStore.ts)
  routes/              routers
  types/event.ts       Zod schemas, the source of truth for the event shape
  utils/eventFilter.ts filtering for GET /api/events
  pipeline/            standalone ingestion process (never imported by the server)
frontend/
  src/app/             Redux store and typed hooks
  src/features/events/ slice, axios service, filtering, agenda grouping
  src/components/      cards, badges, filters, header/footer
  src/pages/           Today (default), Calendar, About
  src/types/event.ts   mirrors backend/types/event.ts
```

## Status

- **Phase 1** (backend and data foundation): done.
- **Phase 2** (keyword classifier and basic UI): done.
- **Phase 3** (scheduled refresh): the workflow is ready and needs the one-time setup above. Deploy and a second source are still to do.
- **Phase 4** (LLM classification for borderline events, `.ics` feed): later.
