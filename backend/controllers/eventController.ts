import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import type { ZodError } from "zod";
import { loadSnapshot } from "../models/eventStore.js";
import {
  PUBLIC_AUDIENCES,
  calendarSelectionSchema,
  eventIdSchema,
  eventQuerySchema,
  type Audience,
} from "../types/event.js";
import { selectEvents } from "../utils/eventFilter.js";
import { buildCalendar } from "../utils/ics.js";

const describeZodError = (error: ZodError): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`).join("; ");

// The snapshot this app serves (set by createApp).
const snapshotFor = (req: Request) => {
  const file: unknown = req.app.locals.eventsFile;
  return loadSnapshot(typeof file === "string" ? file : undefined);
};

// @desc    Get events
// @route   GET /api/events
// @access  Public
export const getEvents = asyncHandler(async (req: Request, res: Response) => {
  const query = eventQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400);
    throw new Error(describeZodError(query.error));
  }

  const { events } = await snapshotFor(req);
  res.status(200).json(selectEvents(events, query.data, new Date()));
});

// Like the app's default view, the calendar file leaves out "Food possible"
// matches unless the request asks for them with minConfidence.
const CALENDAR_MIN_CONFIDENCE = 0.45;

// @desc    Get events as an iCalendar file (import or subscribe in Google Calendar)
// @route   GET /api/events/calendar.ics
// @access  Public
export const getCalendar = asyncHandler(async (req: Request, res: Response) => {
  const query = eventQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400);
    throw new Error(describeZodError(query.error));
  }
  const selection = calendarSelectionSchema.safeParse(req.query);
  if (!selection.success) {
    res.status(400);
    throw new Error(describeZodError(selection.error));
  }

  const { events } = await snapshotFor(req);
  const now = new Date();
  const { ids, exclude } = selection.data;
  const only = ids && new Set(ids);
  const skip = new Set(exclude ?? []);
  const selected = selectEvents(events, { minConfidence: CALENDAR_MIN_CONFIDENCE, ...query.data }, now).filter(
    (event) => (!only || only.has(event.id)) && !skip.has(event.id),
  );
  res
    .status(200)
    .type("text/calendar; charset=utf-8")
    .attachment("free-stanfood.ics")
    .send(buildCalendar(selected, now));
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

  const { events } = await snapshotFor(req);
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
