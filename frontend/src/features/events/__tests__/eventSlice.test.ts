import { describe, expect, it } from "vitest";
import { makeEvent } from "../../../testUtils";
import reducer, { getEvents, reset, setFilters } from "../eventSlice";

const initial = reducer(undefined, { type: "init" });

describe("eventSlice", () => {
  it("stores events from the latest request", () => {
    const pending = reducer(initial, getEvents.pending("req-1", {}));
    expect(pending.isLoading).toBe(true);
    const done = reducer(pending, getEvents.fulfilled([makeEvent()], "req-1", {}));
    expect(done).toMatchObject({ isLoading: false, isSuccess: true, isError: false });
    expect(done.events).toHaveLength(1);
  });

  it("ignores a stale response from an earlier request", () => {
    let state = reducer(initial, getEvents.pending("old", {}));
    state = reducer(state, getEvents.pending("new", {}));
    state = reducer(state, getEvents.fulfilled([makeEvent({ id: "stale" })], "old", {}));
    expect(state.events).toEqual([]);
    expect(state.isLoading).toBe(true);
  });

  it("records the API error message", () => {
    let state = reducer(initial, getEvents.pending("req-1", {}));
    state = reducer(state, getEvents.rejected(null, "req-1", {}, "from: must be an ISO 8601 date"));
    expect(state).toMatchObject({ isLoading: false, isError: true, message: "from: must be an ISO 8601 date" });
  });

  it("keeps filters on reset", () => {
    let state = reducer(initial, setFilters({ query: "pizza" }));
    state = reducer(state, getEvents.fulfilled([makeEvent()], "req-1", {}));
    state = reducer(state, reset());
    expect(state.events).toEqual([]);
    expect(state.filters.query).toBe("pizza");
  });
});

describe("eventSlice reset during navigation", () => {
  it("keeps a request the next page already started", () => {
    // The incoming calendar's request starts before the outgoing page resets.
    let state = reducer(initial, getEvents.fulfilled([makeEvent({ id: "today" })], "today", {}));
    state = reducer(state, getEvents.pending("calendar", {}));
    state = reducer(state, reset());
    expect(state).toMatchObject({ events: [], isSuccess: false, isLoading: true });
    state = reducer(state, getEvents.fulfilled([makeEvent({ id: "calendar" })], "calendar", {}));
    expect(state).toMatchObject({ isLoading: false, isSuccess: true });
    expect(state.events.map((e) => e.id)).toEqual(["calendar"]);
  });

  it("stops loading without an error when the current request is aborted", () => {
    let state = reducer(initial, getEvents.pending("req-1", {}));
    state = reducer(state, reset());
    const aborted = getEvents.rejected(new DOMException("Aborted", "AbortError"), "req-1", {});
    state = reducer(state, { ...aborted, meta: { ...aborted.meta, aborted: true } });
    expect(state).toMatchObject({ isLoading: false, isError: false, message: "", currentRequestId: null });
  });
});
