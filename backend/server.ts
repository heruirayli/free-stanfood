import path from "node:path";
import dotenv from "dotenv";
import express from "express";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import eventRoutes from "./routes/eventRoutes.js";

dotenv.config({ quiet: true });

const port = Number(process.env.PORT) || 5000;

// Event data comes from data/events.json (written by the pipeline). See models/eventStore.ts.
const app = express();
app.disable("x-powered-by");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/events", eventRoutes);
app.use("/api", notFound);

// Serve frontend
if (process.env.NODE_ENV === "production") {
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

app.listen(port, () => console.log(`Server started on port ${port}`));
