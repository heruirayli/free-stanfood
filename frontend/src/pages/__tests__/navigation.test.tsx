import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "../../app/store";
import eventService from "../../features/events/eventService";
import { makeEvent } from "../../testUtils";
import type { EventQuery } from "../../types/event";
import CalendarPage from "../CalendarPage";
import Today from "../Today";

// FullCalendar renders slowly in jsdom on a busy machine.
const SLOW = { timeout: 5000 };

type Call = [EventQuery, AbortSignal?];
// Today's own loads: today, or today and tomorrow. Not the two-week look ahead
// for the next free food when nothing's left.
const isTodayLoad = ([query]: Call): boolean =>
  query.from !== undefined && query.to !== undefined && Date.parse(query.to) - Date.parse(query.from) <= 2 * 86_400_000;
const todayLoads = (calls: Call[]) => calls.filter(isTodayLoad).map(([query]) => query);

// Rendered without StrictMode on purpose: its double effects re-send the
// calendar's request and hid the Today -> Calendar race in development.
const renderApp = () => {
  const store = makeStore();
  render(
    <Provider store={store}>
      <MemoryRouter>
        <nav>
          <Link to="/">Today</Link>
          <Link to="/week">Week</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/week" element={<CalendarPage view="week" />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return store;
};

describe("Today -> Week navigation", () => {
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
      fireEvent.click(screen.getByRole("link", { name: "Week" }));
    });
    // Today's range and the calendar's range (the export list makes its own, undated request).
    // Today's load and the calendar's week: not the export list (no dates) or
    // Today's two-week look ahead for the next free food.
    const days = ([query]: Call) => (Date.parse(query.to ?? "") - Date.parse(query.from ?? "")) / 86_400_000;
    const rangeRequests = () =>
      vi.mocked(eventService.getEvents).mock.calls.filter((call) => call[0].from !== undefined && Math.round(days(call)) !== 14);
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

  it("refetches when the campus day rolls over, so Today covers the new day", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-02T06:58:00Z")); // Oct 1, 11:58 PM PDT
    const getEvents = vi.spyOn(eventService, "getEvents").mockImplementation(async () => []);
    const store = renderApp();
    await waitFor(() => expect(store.getState().events.isSuccess).toBe(true), SLOW);
    // In the evening: today and tomorrow.
    expect(todayLoads(getEvents.mock.calls)).toEqual([
      expect.objectContaining({ from: "2026-10-01T07:00:00.000Z", to: "2026-10-03T07:00:00.000Z" }),
    ]);

    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000); // past campus midnight
    });
    await waitFor(() => expect(todayLoads(getEvents.mock.calls)).toHaveLength(2), SLOW);
    expect(todayLoads(getEvents.mock.calls)[1]).toMatchObject({
      from: "2026-10-02T07:00:00.000Z",
      to: "2026-10-03T07:00:00.000Z",
    });
  }, 20_000);

  it("loads tomorrow too once it's 8 PM", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-02T02:55:00Z")); // Oct 1, 7:55 PM PDT
    const getEvents = vi.spyOn(eventService, "getEvents").mockImplementation(async () => []);
    const store = renderApp();
    await waitFor(() => expect(store.getState().events.isSuccess).toBe(true), SLOW);
    expect(todayLoads(getEvents.mock.calls)).toEqual([expect.objectContaining({ to: "2026-10-02T07:00:00.000Z" })]);

    await act(async () => {
      vi.advanceTimersByTime(6 * 60_000); // 8:01 PM
    });
    await waitFor(() => expect(todayLoads(getEvents.mock.calls)).toHaveLength(2), SLOW);
    expect(todayLoads(getEvents.mock.calls)[1]).toMatchObject({ to: "2026-10-03T07:00:00.000Z" });
  }, 20_000);
});

describe("Week on a phone", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists the next seven days from today, not the calendar week", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T19:00:00Z")); // Thursday, Oct 8, noon PDT
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const getEvents = vi.spyOn(eventService, "getEvents").mockImplementation(async () => []);
    render(
      <Provider store={makeStore()}>
        <MemoryRouter initialEntries={["/week"]}>
          <Routes>
            <Route path="/week" element={<CalendarPage view="week" />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    // The calendar's range request: Thursday through next Wednesday, not Sunday to Saturday.
    const rangeRequests = () => getEvents.mock.calls.filter(([query]) => query.from !== undefined);
    await waitFor(() => expect(rangeRequests()).toHaveLength(1), SLOW);
    expect(rangeRequests()[0]![0]).toMatchObject({ from: "2026-10-08T07:00:00.000Z", to: "2026-10-15T07:00:00.000Z" });
  }, 20_000);
});
