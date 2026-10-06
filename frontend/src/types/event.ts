// Mirrors backend/types/event.ts (keep in sync) as the event arrives over JSON:
// Dates are ISO 8601 strings. Named FoodEvent to avoid clashing with the DOM `Event`.

export type Audience = "open" | "rsvp" | "restricted" | "unknown";
export type PublicAudience = Exclude<Audience, "restricted">;
export type ClassifiedBy = "keywords";

export interface FoodEvent {
  id: string;
  source: string;
  sourceEventId: string;
  sourceUrl: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string | null;
  allDay: boolean;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  hostOrg: string | null;
  audience: Audience;
  audienceNote: string | null;
  cost: string | null;
  isVirtual: boolean;
  hasFreeFood: boolean;
  foodConfidence: number;
  foodDetails: string | null;
  classifiedBy: ClassifiedBy;
  firstSeenAt: string;
}

// Query params accepted by GET /api/events. Every published event has free food.
export interface EventQuery {
  from?: string;
  to?: string;
  q?: string;
  minConfidence?: number;
  audience?: PublicAudience;
}

export interface ApiErrorBody {
  message: string;
  stack?: string | null;
}
