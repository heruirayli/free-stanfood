import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../App";
import { makeStore } from "../../app/store";
import eventService from "../../features/events/eventService";
import { makeEvent } from "../../testUtils";

const NOW = new Date("2026-10-01T19:10:00Z"); // Oct 1, 12:10 PM PDT

const lunch = makeEvent({
  id: "lunch".padEnd(24, "0"),
  title: "Lunch seminar",
  foodDetails: "lunch",
  startTime: "2026-10-01T19:00:00Z", // noon
  endTime: "2026-10-01T19:30:00Z", // ends in 20 min
  audience: "unknown",
});
const pizza = makeEvent({ id: "pizza".padEnd(24, "0"), startTime: "2026-10-01T20:30:00Z", endTime: null }); // 1:30 PM, open
const boba = makeEvent({
  id: "boba".padEnd(24, "0"),
  title: "Boba night",
  foodDetails: "boba",
  startTime: "2026-10-02T01:00:00Z", // 6 PM
  endTime: null,
  audience: "rsvp",
});
const ended = makeEvent({
  id: "ended".padEnd(24, "0"),
  title: "Breakfast",
  startTime: "2026-10-01T15:00:00Z", // 8 – 9 AM
  endTime: "2026-10-01T16:00:00Z",
});

// Shows the router's location, to check what the filters write to the URL.
const Location = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="location">{pathname + search}</output>;
};

const renderAt = (route: string) => {
  const store = makeStore();
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
        <Location />
      </MemoryRouter>
    </Provider>,
  );
  return store;
};

const location = () => screen.getByRole("status", { name: "location" }).textContent;
const sectionNames = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("Today page", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(eventService, "getEvents").mockResolvedValue([ended, lunch, pizza, boba]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("groups today's events into sections, leaving out ended ones", async () => {
    renderAt("/");
    await screen.findByText("Lunch seminar");
    expect(sectionNames()).toEqual(["Happening Now1 event", "Later Today1 event", "Tonight1 event"]);
    expect(screen.getByText("Ends in 20 min")).toBeInTheDocument();
    expect(screen.queryByText("Breakfast")).not.toBeInTheDocument();
    // Loads from now to the end of the campus day.
    expect(eventService.getEvents).toHaveBeenCalledWith(
      { from: NOW.toISOString(), to: "2026-10-02T07:00:00.000Z", minConfidence: 0 },
      expect.any(AbortSignal),
    );
  });

  it("hides empty sections", async () => {
    vi.mocked(eventService.getEvents).mockResolvedValue([pizza]);
    renderAt("/");
    await screen.findByText("Pizza and pitch night");
    expect(sectionNames()).toEqual(["Later Today1 event"]);
  });

  it("says when there's nothing, and points to the week", async () => {
    vi.mocked(eventService.getEvents).mockResolvedValue([ended]);
    renderAt("/");
    expect(await screen.findByText("No free food right now. Check back around lunch.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /this week/i })).toHaveAttribute("href", "/week");
  });

  it("shows the error and tries again", async () => {
    vi.mocked(eventService.getEvents).mockRejectedValueOnce(new Error("Network Error"));
    renderAt("/");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Network Error")).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Lunch seminar")).toBeInTheDocument();
  });

  it("filters from the URL it opens with", async () => {
    const store = renderAt("/?open=1&when=2h");
    await screen.findByText("Pizza and pitch night");
    expect(store.getState().events.filters).toMatchObject({ openOnly: true, window: "next2h" });
    expect(screen.getByRole("switch", { name: "Only events open to all" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Next 2 hours" })).toBeChecked();
    expect(screen.queryByText("Lunch seminar")).not.toBeInTheDocument(); // not open to all
    expect(screen.queryByText("Boba night")).not.toBeInTheDocument(); // not within 2 hours
    expect(location()).toBe("/?open=1&when=2h");
  });

  it("writes filter changes to the URL, and clears them", async () => {
    renderAt("/");
    await screen.findByText("Lunch seminar");
    fireEvent.click(screen.getByRole("checkbox", { name: "Boba" }));
    await waitFor(() => expect(location()).toBe("/?food=boba"));
    expect(screen.queryByText("Lunch seminar")).not.toBeInTheDocument();
    expect(screen.getByText("Boba night")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Now" }));
    expect(await screen.findByText("Nothing matches these filters right now.")).toBeInTheDocument();
    await waitFor(() => expect(location()).toBe("/?food=boba&when=now"));

    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);
    await waitFor(() => expect(location()).toBe("/"));
    expect(screen.getByText("Lunch seminar")).toBeInTheDocument();
  });

  it("shows a few food types, with the rest a click away", async () => {
    const foods = ["lunch", "boba", "coffee", "cookies", "dinner", "mochi", "pancakes", "tacos"];
    vi.mocked(eventService.getEvents).mockResolvedValue(
      foods.map((food, i) =>
        makeEvent({ id: food.padEnd(24, "0"), foodDetails: food, startTime: `2026-10-01T2${i % 3}:00:00Z`, endTime: null }),
      ),
    );
    renderAt("/?food=tacos");
    await screen.findAllByText("Lunch");
    const food = within(screen.getByRole("group", { name: "Food" }));
    // The first six, plus "tacos", which is chosen.
    expect(food.getAllByRole("checkbox")).toHaveLength(7);
    expect(food.getByRole("checkbox", { name: "Tacos" })).toBeChecked();
    fireEvent.click(food.getByRole("button", { name: "1 more foods" }));
    expect(food.getAllByRole("checkbox")).toHaveLength(8);
  });

  it("counts the filters folded behind the phone's Filters button", async () => {
    renderAt("/?food=boba&open=1");
    const button = await screen.findByRole("button", { name: /^Filters/ });
    expect(button).toHaveAccessibleName("Filters, 2 on");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps up with typing in the search box", async () => {
    renderAt("/");
    await screen.findByText("Lunch seminar");
    const search = screen.getByRole("searchbox", { name: "Search events" });
    for (const value of ["b", "bo", "bob", "boba"]) fireEvent.change(search, { target: { value } });
    await waitFor(() => expect(location()).toBe("/?q=boba"));
    expect(search).toHaveValue("boba");
    expect(screen.getByText("Boba night")).toBeInTheDocument();
    expect(screen.queryByText("Lunch seminar")).not.toBeInTheDocument();
  });

  it("opens an event's details over the list, and goes back to it on close", async () => {
    renderAt("/?food=boba");
    fireEvent.click(await screen.findByRole("link", { name: "Boba night" }));

    const sheet = await screen.findByRole("dialog", { name: "Boba night" });
    expect(location()).toBe(`/events/${boba.id}`);
    expect(within(sheet).getByRole("heading", { level: 2, name: "Boba night" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /view original event/i })).toBeInTheDocument();
    // The list stays underneath, filtered as it was.
    expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(location()).toBe("/?food=boba");
    expect(eventService.getEvents).toHaveBeenCalledTimes(1); // the list didn't reload
  });
});

describe("an event's own page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the event when opened directly", async () => {
    vi.spyOn(eventService, "getEvent").mockResolvedValue(boba);
    renderAt(`/events/${boba.id}`);
    expect(await screen.findByRole("heading", { level: 1, name: "Boba night" })).toBeInTheDocument();
    expect(eventService.getEvent).toHaveBeenCalledWith(boba.id, expect.any(AbortSignal));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says when the event can't be found", async () => {
    vi.spyOn(eventService, "getEvent").mockRejectedValue(new Error("Event not found"));
    renderAt("/events/nope");
    expect(await screen.findByText("Event not found")).toBeInTheDocument();
  });

  it("sends the old /calendar address to the week", async () => {
    vi.spyOn(eventService, "getEvents").mockResolvedValue([]);
    renderAt("/calendar?food=pizza");
    await waitFor(() => expect(location()).toBe("/week?food=pizza"));
    await act(async () => {});
  });
});
