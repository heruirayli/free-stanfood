import axios from "axios";
import type { EventQuery, FoodEvent } from "../../types/event";
import { parseEvent, parseEvents } from "./parseEvents";

const API_URL = "/api/events/";

// Get events in a window
const getEvents = async (query: EventQuery, signal?: AbortSignal): Promise<FoodEvent[]> => {
  const response = await axios.get<unknown>(API_URL, { params: query, signal });
  return parseEvents(response.data);
};

// Get a single event
const getEvent = async (id: string, signal?: AbortSignal): Promise<FoodEvent> => {
  const response = await axios.get<unknown>(API_URL + encodeURIComponent(id), { signal });
  return parseEvent(response.data);
};

const eventService = {
  getEvents,
  getEvent,
};

export default eventService;
