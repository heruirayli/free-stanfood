import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../App";
import { makeStore } from "../../app/store";
import eventService from "../../features/events/eventService";
import { toggleSaved } from "../../features/saved/savedEvents";
import { makeEvent } from "../../testUtils";

const NOW = new Date("2026-10-01T19:10:00Z"); // Thursday, Oct 1, 12:10 PM PDT

const pizza = makeEvent({ id: "a".repeat(24), title: "Pizza talk", startTime: "2026-10-01T21:00:00Z", endTime: null });
const boba = makeEvent({ id: "b".repeat(24), title: "Boba social", startTime: "2026-10-06T01:00:00Z", endTime: null });
const takenDown = makeEvent({ id: "c".repeat(24), title: "Cancelled dinner", startTime: "2026-10-03T02:00:00Z", endTime: null });
const notSaved = makeEvent({ id: "d".repeat(24), title: "Bagel break", startTime: "2026-10-02T16:00:00Z", endTime: null });

const renderSaved = () =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={["/saved"]}>
        <AppRoutes />
      </MemoryRouter>
    </Provider>,
  );

describe("Saved page", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(eventService, "getEvents").mockResolvedValue([pizza, notSaved, boba]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("explains itself when nothing's saved, without loading events", async () => {
    renderSaved();
    expect(await screen.findByText("No saved events yet.")).toBeInTheDocument();
    expect(eventService.getEvents).not.toHaveBeenCalled();
  });

  it("lists the saved events by day, with one download for all of them", async () => {
    act(() => {
      toggleSaved(boba);
      toggleSaved(pizza);
    });
    renderSaved();
    expect(await screen.findByText("Pizza talk")).toBeInTheDocument();
    expect(screen.getByText("Boba social")).toBeInTheDocument();
    expect(screen.queryByText("Bagel break")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Today1 event",
      "Mon, Oct 51 event",
    ]);
    // Every upcoming event, then the saved ones among them.
    expect(eventService.getEvents).toHaveBeenCalledWith({ minConfidence: 0 }, expect.any(AbortSignal));

    const download = screen.getByRole("link", { name: "Add all 2 to calendar" });
    const url = new URL(download.getAttribute("href") ?? "", "http://localhost");
    expect(url.pathname).toBe("/api/events/calendar.ics");
    expect(Object.fromEntries(url.searchParams)).toEqual({ ids: `${pizza.id},${boba.id}`, minConfidence: "0", alarm: "30" });
  });

  it("names saved events that are no longer listed, and clears them", async () => {
    act(() => {
      toggleSaved(pizza);
      toggleSaved(takenDown);
    });
    renderSaved();
    expect(await screen.findByRole("heading", { name: "No longer listed" })).toBeInTheDocument();
    expect(screen.getByText("Cancelled dinner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove it" }));
    await waitFor(() => expect(screen.queryByText("Cancelled dinner")).not.toBeInTheDocument());
    expect(screen.getByText("Pizza talk")).toBeInTheDocument();
  });
});
