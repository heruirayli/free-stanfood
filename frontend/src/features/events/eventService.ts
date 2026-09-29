import axios from "axios";
import type { EventQuery, FoodEvent } from "../../types/event";

const API_URL = "/api/events/";

// Get events in a window
const getEvents = async (query: EventQuery, signal?: AbortSignal): Promise<FoodEvent[]> => {
  const response = await axios.get<FoodEvent[]>(API_URL, { params: query, signal });
  return response.data;
};

// Get a single event
const getEvent = async (id: string, signal?: AbortSignal): Promise<FoodEvent> => {
  const response = await axios.get<FoodEvent>(API_URL + encodeURIComponent(id), { signal });
  return response.data;
};

const eventService = {
  getEvents,
  getEvent,
};

export default eventService;
