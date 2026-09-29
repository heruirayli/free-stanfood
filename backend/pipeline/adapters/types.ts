import type { NormalizedEvent } from "../../types/event.js";

// Raw records are whatever the source returns. Adapters must validate them
// (with Zod) inside `normalize` rather than trusting their shape.
export type RawEvent = unknown;

export interface SourceAdapter {
  name: string;
  fetch(): Promise<RawEvent[]>;
  // Returns null (and logs why) for records that are invalid or must not be shown,
  // such as private or cancelled events.
  normalize(raw: RawEvent): NormalizedEvent | null;
}

// Thrown when a source responds with something we can't use. `rawBody` is
// written to debug/ so the failure can be diagnosed offline.
export class SourceFetchError extends Error {
  constructor(
    message: string,
    readonly rawBody?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SourceFetchError";
  }
}
