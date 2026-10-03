import path from "node:path";
import express from "express";
import { EVENTS_FILE } from "./config/paths.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import eventRoutes from "./routes/eventRoutes.js";

export interface AppOptions {
  // Snapshot the API reads. Tests point this at a temporary file.
  eventsFile?: string;
  serveFrontend?: boolean;
}

// Builds the Express app without listening, so tests can run it on a free port.
// Event data comes from data/events.json (written by the pipeline). See models/eventStore.ts.
export const createApp = ({
  eventsFile = EVENTS_FILE,
  serveFrontend = process.env.NODE_ENV === "production",
}: AppOptions = {}): express.Express => {
  const app = express();
  app.disable("x-powered-by");
  app.locals.eventsFile = eventsFile;

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use("/api/events", eventRoutes);
  app.use("/api", notFound);

  // Serve frontend
  if (serveFrontend) {
    const clientBuild = path.resolve("frontend", "dist");
    app.use(express.static(clientBuild));
    app.get("/*splat", (_req, res) => {
      res.sendFile(path.join(clientBuild, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.send("API is running. Set NODE_ENV=production to serve the frontend build.");
    });
  }

  app.use(errorHandler);
  return app;
};
