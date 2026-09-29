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
