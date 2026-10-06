import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import eventReducer from "../../features/events/eventSlice";
import eventService from "../../features/events/eventService";
import { makeEvent } from "../../testUtils";
import CalendarPage from "../CalendarPage";
import Today from "../Today";

// FullCalendar renders slowly in jsdom on a busy machine.
const SLOW = { timeout: 5000 };

// Rendered without StrictMode on purpose: its double effects re-send the
// calendar's request and hid the Today -> Calendar race in development.
const renderApp = () => {
  const store = configureStore({ reducer: { events: eventReducer } });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <nav>
          <Link to="/">Today</Link>
          <Link to="/calendar">Calendar</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return store;
};

describe("Today -> Calendar navigation", () => {
  beforeEach(() => {
    // jsdom has no matchMedia; report a desktop-width screen.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.spyOn(eventService, "getEvents").mockImplementation(async () => [makeEvent()]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the calendar's events when the Today page resets on the way out", async () => {
    const store = renderApp();
    await waitFor(() => expect(store.getState().events.isSuccess).toBe(true), SLOW);

    // FullCalendar requests its range during the layout phase, before Today's
    // cleanup runs, so that cleanup must not discard the calendar's request.
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Calendar" }));
    });
    // Today's range and the calendar's range (the export list makes its own, undated request).
    const rangeRequests = () => vi.mocked(eventService.getEvents).mock.calls.filter(([query]) => query.from !== undefined);
    await waitFor(() => expect(rangeRequests()).toHaveLength(2), SLOW);
    await waitFor(() => expect(store.getState().events).toMatchObject({ isLoading: false, isSuccess: true }), SLOW);
    expect(store.getState().events.events).toHaveLength(1);
  }, 20_000);
});

describe("Today page overnight", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("refetches when the campus day rolls over, so Tomorrow covers the new day", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-02T06:58:00Z")); // Oct 1, 11:58 PM PDT
    const getEvents = vi.spyOn(eventService, "getEvents").mockImplementation(async () => []);
    const store = renderApp();
    await waitFor(() => expect(store.getState().events.isSuccess).toBe(true), SLOW);
    expect(getEvents).toHaveBeenLastCalledWith(expect.objectContaining({ to: "2026-10-03T07:00:00.000Z" }), expect.anything());

    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000); // past campus midnight
    });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2), SLOW);
    expect(getEvents).toHaveBeenLastCalledWith(expect.objectContaining({ to: "2026-10-04T07:00:00.000Z" }), expect.anything());
  }, 20_000);
});
