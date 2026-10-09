import axios from "axios";
import { STATIC_DATA } from "../../constants";
import type { DataStatus, EventQuery, FoodEvent } from "../../types/event";
import { parseEvent, parseEvents, parseStatus } from "./parseEvents";
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

// Get when the listings last changed. The static build ships it as a file.
const getStatus = async (signal?: AbortSignal): Promise<DataStatus> => {
  const url = STATIC_DATA ? `${import.meta.env.BASE_URL}data/status.json` : `${API_URL}status`;
  const response = await axios.get<unknown>(url, { signal });
  return parseStatus(response.data);
};

const eventService = {
  getEvents,
  getEvent,
  getStatus,
};

export default eventService;
