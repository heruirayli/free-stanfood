import path from "node:path";

// The published event snapshot. The pipeline writes it, GitHub Actions commits
// it, and the Express server reads it. Resolved from the repo root, where the
// npm scripts run.
export const EVENTS_FILE = path.resolve("data", "events.json");

// Listings hosts asked to remove. Edited by hand and committed; the pipeline reads it.
export const REMOVED_FILE = path.resolve("data", "removed.json");

// ETags and Last-Modified dates from the previous run, for conditional requests.
// Gitignored; GitHub Actions keeps it between runs with actions/cache.
export const HTTP_CACHE_FILE = path.resolve(".cache", "http-cache.json");
