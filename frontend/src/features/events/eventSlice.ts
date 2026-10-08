import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";
import type { EventQuery, FoodEvent } from "../../types/event";
import { errorMessage } from "./errorMessage";
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
    // Clears loaded events and status, but keeps the user's filters. An in-flight
    // request survives: FullCalendar starts the incoming page's fetch (in the layout
    // phase) before the outgoing page's cleanup resets, and that fetch must still land.
    reset: (state) => ({
      ...initialState,
      filters: state.filters,
      isLoading: state.isLoading,
      currentRequestId: state.currentRequestId,
    }),
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
        if (state.currentRequestId !== action.meta.requestId) return;
        state.isLoading = false;
        state.currentRequestId = null;
        // An abort is a page leaving, not a failure: stop loading but show no error.
        if (action.meta.aborted) return;
        state.isError = true;
        state.message = action.payload ?? action.error.message ?? "Could not load events";
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
