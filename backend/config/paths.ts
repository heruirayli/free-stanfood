import path from "node:path";

// The published event snapshot. The pipeline writes it, GitHub Actions commits
// it, and the Express server reads it. Resolved from the repo root, where the
// npm scripts run.
export const EVENTS_FILE = path.resolve("data", "events.json");
