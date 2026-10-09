import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../App";
import { makeStore } from "../../app/store";
import eventService from "../../features/events/eventService";
import { makeEvent } from "../../testUtils";

const NOW = new Date("2026-10-01T19:10:00Z"); // Thursday, Oct 1, 12:10 PM PDT

const todayPizza = makeEvent({ id: "a".repeat(24), title: "Pizza talk", startTime: "2026-10-01T21:00:00Z", endTime: null });
const tomorrowPizza = makeEvent({ id: "b".repeat(24), title: "Pizza social", startTime: "2026-10-02T19:00:00Z", endTime: null });
const laterPizza = makeEvent({
  id: "c".repeat(24),
  title: "Pizza and planning",
  startTime: "2026-11-12T20:00:00Z",
  endTime: null,
  audience: "rsvp",
});

const Location = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="location">{pathname + search}</output>;
};

const renderAt = (route: string) =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
        <Location />
      </MemoryRouter>
    </Provider>,
  );

const location = () => screen.getByRole("status", { name: "location" }).textContent;
const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("Search page", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(eventService, "getEvents").mockResolvedValue([todayPizza, tomorrowPizza, laterPizza]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("asks the API for every upcoming match and lists them by day", async () => {
    renderAt("/search?q=pizza");
    await screen.findByText("Pizza and planning");
    // From now to a year ahead: the API's default window.
    expect(eventService.getEvents).toHaveBeenCalledWith({ q: "pizza", minConfidence: 0 }, expect.any(AbortSignal));
    expect(headings()).toEqual(["Today1 event", "Tomorrow1 event", "Thu, Nov 121 event"]);
    expect(screen.getByText("3 upcoming events")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Search" })).toBeInTheDocument();
  });

  it("invites a search before there is one, without asking the API", () => {
    renderAt("/search");
    expect(screen.getByText("Search every upcoming event.")).toBeInTheDocument();
    expect(eventService.getEvents).not.toHaveBeenCalled();
  });

  it("searches again as you type, and keeps focus in the box", async () => {
    renderAt("/search?q=pizza");
    await screen.findByText("Pizza talk");
    const box = screen.getByRole("searchbox", { name: "Search events" });
    box.focus();
    vi.mocked(eventService.getEvents).mockResolvedValue([laterPizza]);
    fireEvent.change(box, { target: { value: "pizza planning" } });
    await waitFor(() =>
      expect(eventService.getEvents).toHaveBeenLastCalledWith({ q: "pizza planning", minConfidence: 0 }, expect.any(AbortSignal)),
    );
    await waitFor(() => expect(screen.queryByText("Pizza talk")).not.toBeInTheDocument());
    expect(screen.getByText("Pizza and planning")).toBeInTheDocument();
    expect(location()).toBe("/search?q=pizza+planning");
    expect(box).toHaveFocus();
  });

  it("says when nothing matches, and Clear filters keeps the search", async () => {
    renderAt("/search?q=pizza&food=sushi");
    expect(await screen.findByText("No upcoming events match “pizza”.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);
    await waitFor(() => expect(location()).toBe("/search?q=pizza"));
    expect(await screen.findByText("Pizza talk")).toBeInTheDocument();
  });
});

describe("searching from Today", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(eventService, "getEvents").mockResolvedValue([todayPizza]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("offers every upcoming event while you type, and Enter goes there", async () => {
    renderAt("/");
    await screen.findByText("Pizza talk");
    expect(screen.queryByRole("link", { name: /search all upcoming/i })).not.toBeInTheDocument();

    const box = screen.getByRole("searchbox", { name: "Search events" });
    fireEvent.change(box, { target: { value: "pizza" } });
    expect(screen.getByRole("link", { name: "Search all upcoming events for “pizza”" })).toHaveAttribute(
      "href",
      "/search?q=pizza",
    );

    fireEvent.submit(box.closest("form")!);
    await waitFor(() => expect(location()).toBe("/search?q=pizza"));
    expect(await screen.findByRole("heading", { level: 1, name: "Search" })).toBeInTheDocument();
  });
});
