import axios from "axios";
import { STATIC_DATA } from "../../constants";
import type { EventQuery, FoodEvent } from "../../types/event";
import { parseEvent, parseEvents } from "./parseEvents";
import { loadStaticEvents, selectStaticEvents } from "./staticEvents";

const API_URL = "/api/events/";

// Get events in a window
const getEvents = async (query: EventQuery, signal?: AbortSignal): Promise<FoodEvent[]> => {
  if (STATIC_DATA) return selectStaticEvents(await loadStaticEvents(), query, new Date());
  const response = await axios.get<unknown>(API_URL, { params: query, signal });
  return parseEvents(response.data);
};

// Get a single event
const getEvent = async (id: string, signal?: AbortSignal): Promise<FoodEvent> => {
  if (STATIC_DATA) {
    const event = (await loadStaticEvents()).find((candidate) => candidate.id === id);
    if (!event) throw new Error("Event not found");
    return event;
  }
  const response = await axios.get<unknown>(API_URL + encodeURIComponent(id), { signal });
  return parseEvent(response.data);
};

const eventService = {
  getEvents,
  getEvent,
};

export default eventService;
