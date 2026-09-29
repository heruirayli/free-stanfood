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

export const classifiedBySchema = z.enum(["keywords", "llm"]);
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
export const eventSchema = normalizedEventSchema.extend({
  // Stable hash of source + sourceEventId.
  id: z.string().min(1),
  ...classificationSchema.shape,
  // When this event first appeared in a published snapshot. Survives re-runs.
  firstSeenAt: z.date(),
});
export type Event = z.infer<typeof eventSchema>;

// Query params for GET /api/events. Express hands us strings, so coerce.
// Every published event has free food, so there is no food on/off param.
export const eventQuerySchema = z
  .object({
    from: z.coerce.date({ error: "must be an ISO 8601 date" }).optional(),
    to: z.coerce.date({ error: "must be an ISO 8601 date" }).optional(),
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
