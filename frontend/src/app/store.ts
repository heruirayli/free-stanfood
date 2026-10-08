import { combineReducers, configureStore } from "@reduxjs/toolkit";
import eventReducer from "../features/events/eventSlice";
import exportReducer from "../features/events/exportSlice";

const rootReducer = combineReducers({
  events: eventReducer,
  calendarExport: exportReducer,
});

// A fresh store. The app uses one; each test makes its own.
export const makeStore = () => configureStore({ reducer: rootReducer });

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
