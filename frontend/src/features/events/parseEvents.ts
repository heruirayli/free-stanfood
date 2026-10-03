import type { FoodEvent } from "../../types/event";

// Runtime check of API responses, so an unexpected body (an HTML page from a proxy,
// a changed API shape) becomes a load error instead of crashing the page.
// Keyed by FoodEvent's fields, so adding a field to the type requires a check here.

type Check = (value: unknown) => boolean;

const isString: Check = (value) => typeof value === "string";
const isBoolean: Check = (value) => typeof value === "boolean";
const isNumber: Check = (value) => typeof value === "number" && Number.isFinite(value);
const isDate: Check = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const nullable =
  (check: Check): Check =>
  (value) =>
    value === null || check(value);
const oneOf =
  (...options: string[]): Check =>
  (value) =>
    typeof value === "string" && options.includes(value);

const FIELDS: Record<keyof FoodEvent, Check> = {
  id: isString,
  source: isString,
  sourceEventId: isString,
  sourceUrl: isString,
  title: isString,
  description: isString,
  startTime: isDate,
  endTime: nullable(isDate),
  allDay: isBoolean,
  locationName: nullable(isString),
  lat: nullable(isNumber),
  lng: nullable(isNumber),
  hostOrg: nullable(isString),
  audience: oneOf("open", "rsvp", "restricted", "unknown"),
  audienceNote: nullable(isString),
  cost: nullable(isString),
  isVirtual: isBoolean,
  hasFreeFood: isBoolean,
  foodConfidence: isNumber,
  foodDetails: nullable(isString),
  classifiedBy: oneOf("keywords", "llm"),
  firstSeenAt: isDate,
};

const CHECKS = Object.entries(FIELDS);

const isFoodEvent = (value: unknown): value is FoodEvent => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return CHECKS.every(([key, check]) => check(record[key]));
};

export const UNEXPECTED_RESPONSE = "The events service sent an unexpected response.";

export const parseEvents = (data: unknown): FoodEvent[] => {
  if (!Array.isArray(data) || !data.every(isFoodEvent)) throw new Error(UNEXPECTED_RESPONSE);
  return data;
};

export const parseEvent = (data: unknown): FoodEvent => {
  if (!isFoodEvent(data)) throw new Error(UNEXPECTED_RESPONSE);
  return data;
};
