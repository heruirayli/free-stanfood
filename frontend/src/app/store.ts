import { configureStore } from "@reduxjs/toolkit";
import eventReducer from "../features/events/eventSlice";

export const store = configureStore({
  reducer: {
    events: eventReducer,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
