import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

// Single source of truth for the event shape. The snapshot file format
// (models/eventSnapshot.ts) and the frontend types (frontend/src/types/event.ts)
// mirror these definitions.

export const AUDIENCES = ["open", "rsvp", "restricted", "unknown"] as const;
export const audienceSchema = z.enum(AUDIENCES);
export type Audience = z.infer<typeof audienceSchema>;

// Audiences that may be published. Restricted events are normalized (so their
// counts show up in run summaries) but never written to the public snapshot.
export const PUBLIC_AUDIENCES = ["open", "rsvp", "unknown"] as const;
export const publicAudienceSchema = z.enum(PUBLIC_AUDIENCES);

// Classification is rule-based only (no LLM), so this is always "keywords".
export const classifiedBySchema = z.enum(["keywords"]);
export type ClassifiedBy = z.infer<typeof classifiedBySchema>;

// What an adapter produces: source-agnostic, validated, not yet classified.
export const normalizedEventSchema = z.object({
  source: z.string().min(1),
  sourceEventId: z.string().min(1),
  sourceUrl: z.url(),
  title: z.string().trim().min(1),
  description: z.string(),
  startTime: z.date(),
  endTime: z.date().nullable(),
  allDay: z.boolean(),
  locationName: z.string().nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  hostOrg: z.string().nullable(),
  audience: audienceSchema,
  // The host's own wording about who may attend, e.g. "Current Stanford students".
  audienceNote: z.string().nullable(),
  // Ticket or admission text as listed by the source, e.g. "Free" or "$20".
  cost: z.string().nullable(),
  isVirtual: z.boolean(),
  // The host's own "food provided" checkbox, where the source has one (CardinalEngage).
  // Only the classifier reads it; it isn't published.
  foodProvided: z.boolean().optional(),
});
export type NormalizedEvent = z.infer<typeof normalizedEventSchema>;

export const classificationSchema = z.object({
  hasFreeFood: z.boolean(),
  foodConfidence: z.number().min(0).max(1),
  foodDetails: z.string().nullable(),
  classifiedBy: classifiedBySchema,
});
export type Classification = z.infer<typeof classificationSchema>;

// A published event, as stored in data/events.json and returned by the API.
export const eventSchema = normalizedEventSchema.omit({ foodProvided: true }).extend({
  // Stable hash of source + sourceEventId.
  id: z.string().min(1),
  ...classificationSchema.shape,
  // When this event first appeared in a published snapshot. Survives re-runs.
  firstSeenAt: z.date(),
});
export type Event = z.infer<typeof eventSchema>;

// Campus time, for date-only query params. (The pipeline has its own copy; the
// server never imports pipeline code.)
const CAMPUS_TIME_ZONE = "America/Los_Angeles";

// An ISO 8601 date-time with an offset ("2026-10-01T07:00:00Z"), or a plain date
// ("2026-10-01") meaning midnight on campus. Anything else is a 400, rather than
// whatever `new Date()` would make of it.
const queryDate = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()], { error: "must be an ISO 8601 date" })
  .transform((value) => (value.length === 10 ? fromZonedTime(`${value}T00:00:00`, CAMPUS_TIME_ZONE) : new Date(value)));

// Query params for GET /api/events. Express hands us strings, so coerce.
// Every published event has free food, so there is no food on/off param.
export const eventQuerySchema = z
  .object({
    from: queryDate.optional(),
    to: queryDate.optional(),
    q: z.string().trim().max(100).optional(),
    minConfidence: z.coerce.number().min(0).max(1).optional(),
    audience: publicAudienceSchema.optional(),
  })
  .refine((query) => !query.from || !query.to || query.from < query.to, {
    message: "`from` must be before `to`",
    path: ["from"],
  });
export type EventQuery = z.infer<typeof eventQuerySchema>;

export const eventIdSchema = z.string().regex(/^[a-f0-9]{24}$/, "Invalid event id");
