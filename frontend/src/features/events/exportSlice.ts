import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";
import { LIKELY_THRESHOLD } from "../../constants";
import type { FoodEvent } from "../../types/event";
import { errorMessage } from "./errorMessage";
import eventService from "./eventService";

// The "Add to Your Calendar" choices on the Week and Month pages: every upcoming
// event, all chosen until the user drops some. In the store so an event's details,
// which open over the calendar, can add or drop that event too.

// What the export list needs about each event. Kept instead of the full event, so
// a year of descriptions isn't held in memory twice (the calendar has its own copy).
export type ExportItem = Pick<FoodEvent, "id" | "title" | "startTime" | "allDay">;

const toExportItem = ({ id, title, startTime, allDay }: FoodEvent): ExportItem => ({ id, title, startTime, allDay });

interface CalendarExportState {
  items: ExportItem[];
  status: "idle" | "loading" | "ready" | "error";
  deselected: Record<string, true>;
  // Whether the list (and so the download) includes "Food possible" matches.
  includeLow: boolean;
  requestId: string | null;
}

const initialState: CalendarExportState = {
  items: [],
  status: "idle",
  deselected: {},
  includeLow: false,
  requestId: null,
};

// Get every upcoming event to choose from
export const loadExport = createAsyncThunk<ExportItem[], { includeLow: boolean }, { rejectValue: string }>(
  "calendarExport/load",
  async ({ includeLow }, thunkAPI) => {
    try {
      const events = await eventService.getEvents({ minConfidence: includeLow ? 0 : LIKELY_THRESHOLD }, thunkAPI.signal);
      return events.map(toExportItem);
    } catch (error) {
      return thunkAPI.rejectWithValue(errorMessage(error));
    }
  },
);

const choose = (deselected: Record<string, true>, id: string, chosen: boolean): void => {
  if (chosen) delete deselected[id];
  else deselected[id] = true;
};

export const exportSlice = createSlice({
  name: "calendarExport",
  initialState,
  reducers: {
    toggleExportEvent: (state, action: PayloadAction<string>) => {
      choose(state.deselected, action.payload, action.payload in state.deselected);
    },
    setExportEvents: (state, action: PayloadAction<{ ids: string[]; chosen: boolean }>) => {
      for (const id of action.payload.ids) choose(state.deselected, id, action.payload.chosen);
    },
    // Frees the list when the calendar closes.
    clearExport: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadExport.pending, (state, action) => {
        state.status = "loading";
        state.includeLow = action.meta.arg.includeLow;
        state.requestId = action.meta.requestId;
      })
      .addCase(loadExport.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        // A new list starts with everything chosen again.
        state.items = action.payload;
        state.deselected = {};
        state.status = "ready";
        state.requestId = null;
      })
      .addCase(loadExport.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.requestId = null;
        state.status = action.meta.aborted ? "idle" : "error";
      });
  },
});

export const { toggleExportEvent, setExportEvents, clearExport } = exportSlice.actions;

export const selectCalendarExport = (state: RootState) => state.calendarExport;

export default exportSlice.reducer;
