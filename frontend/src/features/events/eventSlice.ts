import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import type { RootState } from "../../app/store";
import type { ApiErrorBody, EventQuery, FoodEvent } from "../../types/event";
import eventService from "./eventService";
import { DEFAULT_FILTERS, applyFilters, foodTypesIn, isLowConfidence, type EventFilters } from "./filterEvents";

interface EventState {
  events: FoodEvent[];
  filters: EventFilters;
  isError: boolean;
  isSuccess: boolean;
  isLoading: boolean;
  message: string;
  // Only the latest request may update the list, so a slow earlier response
  // (e.g. from a previous calendar month) can't overwrite newer results.
  currentRequestId: string | null;
}

const initialState: EventState = {
  events: [],
  filters: DEFAULT_FILTERS,
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: "",
  currentRequestId: null,
};

const isApiErrorBody = (data: unknown): data is ApiErrorBody =>
  typeof data === "object" && data !== null && "message" in data && typeof data.message === "string";

const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data: unknown = error.response?.data;
    if (isApiErrorBody(data)) return data.message;
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
};

// Get events for a time window
export const getEvents = createAsyncThunk<FoodEvent[], EventQuery, { rejectValue: string }>(
  "events/getAll",
  async (query, thunkAPI) => {
    try {
      return await eventService.getEvents(query, thunkAPI.signal);
    } catch (error) {
      return thunkAPI.rejectWithValue(errorMessage(error));
    }
  },
);

export const eventSlice = createSlice({
  name: "events",
  initialState,
  reducers: {
    // Clears loaded events and status, but keeps the user's filters.
    reset: (state) => ({ ...initialState, filters: state.filters }),
    setFilters: (state, action: PayloadAction<Partial<EventFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = { ...DEFAULT_FILTERS, showLowConfidence: state.filters.showLowConfidence };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getEvents.pending, (state, action) => {
        state.isLoading = true;
        state.isError = false;
        state.message = "";
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(getEvents.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.isLoading = false;
        state.isSuccess = true;
        state.events = action.payload;
        state.currentRequestId = null;
      })
      .addCase(getEvents.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId || action.meta.aborted) return;
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload ?? action.error.message ?? "Could not load events";
        state.currentRequestId = null;
      });
  },
});

export const { reset, setFilters, clearFilters } = eventSlice.actions;

export const selectEventState = (state: RootState) => state.events;
export const selectFilters = (state: RootState) => state.events.filters;
const selectAllEvents = (state: RootState) => state.events.events;

export const selectVisibleEvents = createSelector([selectAllEvents, selectFilters], applyFilters);

export const selectFoodTypes = createSelector([selectAllEvents], foodTypesIn);

// Low-confidence events the "Food possible" toggle would reveal under the other filters.
export const selectHiddenLowConfidence = createSelector([selectAllEvents, selectFilters], (events, filters) =>
  filters.showLowConfidence
    ? []
    : applyFilters(events, { ...filters, showLowConfidence: true }).filter(isLowConfidence),
);

export default eventSlice.reducer;
