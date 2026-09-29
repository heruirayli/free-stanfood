import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import type { ZodError } from "zod";
import { loadSnapshot } from "../models/eventStore.js";
import { PUBLIC_AUDIENCES, eventIdSchema, eventQuerySchema, type Audience } from "../types/event.js";
import { selectEvents } from "../utils/eventFilter.js";

const describeZodError = (error: ZodError): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`).join("; ");

// @desc    Get events
// @route   GET /api/events
// @access  Public
export const getEvents = asyncHandler(async (req: Request, res: Response) => {
  const query = eventQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400);
    throw new Error(describeZodError(query.error));
  }

  const { events } = await loadSnapshot();
  res.status(200).json(selectEvents(events, query.data, new Date()));
});

// @desc    Get a single event
// @route   GET /api/events/:id
// @access  Public
export const getEvent = asyncHandler(async (req: Request, res: Response) => {
  const id = eventIdSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400);
    throw new Error("Invalid event id");
  }

  const { events } = await loadSnapshot();
  const event = events.find(
    (candidate) =>
      candidate.id === id.data && (PUBLIC_AUDIENCES as readonly Audience[]).includes(candidate.audience),
  );
  if (!event) {
    res.status(404);
    throw new Error("Event not found");
  }

  res.status(200).json(event);
});
