import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventExportUrl, exportUrl, useCalendarExport } from "../../features/events/calendarExport";
import eventReducer, { setFilters } from "../../features/events/eventSlice";
import eventService from "../../features/events/eventService";
import { makeEvent } from "../../testUtils";
import type { FoodEvent } from "../../types/event";
import CalendarExport from "../CalendarExport";
import EventDialog from "../EventDialog";

const a = makeEvent({ id: "a".repeat(24), title: "Pizza night", startTime: "2026-10-08T01:00:00.000Z" });
const b = makeEvent({ id: "b".repeat(24), title: "Boba social", startTime: "2026-10-09T19:00:00.000Z" });
const c = makeEvent({ id: "c".repeat(24), title: "Taco Tuesday", startTime: "2026-10-13T19:00:00.000Z" });
const d = makeEvent({ id: "d".repeat(24), title: "Bagel break", startTime: "2026-10-09T22:00:00.000Z" });
// Shown on the calendar but outside the upcoming export (more than a year out).
const later = makeEvent({ id: "e".repeat(24), title: "Winter dinner", startTime: "2028-01-20T03:00:00.000Z" });

describe("export URLs", () => {
  it("exports everything with no list by default", () => {
    expect(exportUrl([a, b, c], new Set(), false)).toBe("/api/events/calendar.ics");
  });

  it("sends whichever list is shorter", () => {
    expect(exportUrl([a, b, c], new Set([a.id]), false)).toBe(`/api/events/calendar.ics?exclude=${a.id}`);
    expect(exportUrl([a, b, c], new Set([a.id, b.id]), false)).toBe(`/api/events/calendar.ics?ids=${c.id}`);
  });

  it("asks for 'Food possible' matches when they're shown", () => {
    expect(exportUrl([a], new Set(), true)).toBe("/api/events/calendar.ics?minConfidence=0");
  });

  it("builds a one-event file for any date", () => {
    const url = new URL(eventExportUrl(later), "http://localhost");
    expect(url.pathname).toBe("/api/events/calendar.ics");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      ids: later.id,
      from: "2028-01-20T03:00:00.000Z",
      to: "2028-01-20T03:00:00.001Z",
      minConfidence: "0",
    });
  });
});

// The Calendar page in miniature: one useCalendarExport shared by the export
// section and the event dialog.
const Harness = ({ dialogEvent }: { dialogEvent: FoodEvent | null }) => {
  const state = useCalendarExport();
  const [open, setOpen] = useState(dialogEvent);
  return (
    <>
      <CalendarExport state={state} />
      <EventDialog event={open} now={new Date("2026-10-06T12:00:00Z")} onClose={() => setOpen(null)} exportState={state} />
    </>
  );
};

describe("CalendarExport", () => {
  beforeEach(() => {
    vi.spyOn(eventService, "getEvents").mockResolvedValue([a, b, d, c]);
    // jsdom has no modal dialogs.
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderExport = async (dialogEvent: FoodEvent | null = null) => {
    const store = configureStore({ reducer: { events: eventReducer } });
    render(
      <Provider store={store}>
        <Harness dialogEvent={dialogEvent} />
      </Provider>,
    );
    await screen.findByText(/4 of 4 selected/);
    return store;
  };

  const section = () => within(screen.getByRole("region", { name: "Add to Your Calendar" }));
  const downloadLink = () => section().getByRole("link", { name: /download/i });

  it("selects every event by default", async () => {
    await renderExport();
    expect(section().getAllByRole("checkbox").every((box) => (box as HTMLInputElement).checked)).toBe(true);
    expect(downloadLink()).toHaveAttribute("href", "/api/events/calendar.ics");
  });

  it("leaves out events the user unchecks", async () => {
    await renderExport();
    fireEvent.click(section().getByRole("checkbox", { name: /boba social/i }));
    expect(section().getByText(/3 of 4 selected/)).toBeInTheDocument();
    expect(downloadLink()).toHaveAttribute("href", `/api/events/calendar.ics?exclude=${b.id}`);
    expect(downloadLink()).toHaveTextContent("Download 3 events (.ics)");
  });

  it("selects and clears a whole day from its heading", async () => {
    await renderExport();
    // Day headings in order: Oct 7 (a), Oct 9 (b, d), Oct 13 (c).
    const dayBox = () => section().getAllByRole("checkbox", { name: /^All events on/ })[1] as HTMLInputElement;

    fireEvent.click(dayBox());
    expect(section().getByText(/2 of 4 selected/)).toBeInTheDocument();
    expect(section().getByRole("checkbox", { name: /boba social/i })).not.toBeChecked();
    expect(section().getByRole("checkbox", { name: /bagel break/i })).not.toBeChecked();

    // One event back: the day is half-checked; clicking it selects the whole day.
    fireEvent.click(section().getByRole("checkbox", { name: /boba social/i }));
    expect(dayBox().indeterminate).toBe(true);
    fireEvent.click(dayBox());
    expect(dayBox()).toBeChecked();
    expect(dayBox().indeterminate).toBe(false);
    expect(section().getByText(/4 of 4 selected/)).toBeInTheDocument();
  });

  it("can deselect and reselect everything", async () => {
    await renderExport();
    fireEvent.click(section().getByRole("button", { name: "Deselect all" }));
    expect(section().queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
    expect(section().getByText("Select at least one event to download.")).toBeInTheDocument();
    fireEvent.click(section().getByRole("button", { name: "Select all" }));
    expect(downloadLink()).toHaveAttribute("href", "/api/events/calendar.ics");
  });

  it("reloads the choices when 'Food possible' matches are turned on", async () => {
    const store = await renderExport();
    act(() => {
      store.dispatch(setFilters({ showLowConfidence: true }));
    });
    await screen.findByText(/4 of 4 selected/);
    expect(eventService.getEvents).toHaveBeenLastCalledWith({ minConfidence: 0 }, expect.any(AbortSignal));
    expect(downloadLink()).toHaveAttribute("href", "/api/events/calendar.ics?minConfidence=0");
  });
});

describe("the event dialog and the export", () => {
  beforeEach(() => {
    vi.spyOn(eventService, "getEvents").mockResolvedValue([a, b, d, c]);
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithDialog = async (event: FoodEvent) => {
    const store = configureStore({ reducer: { events: eventReducer } });
    render(
      <Provider store={store}>
        <Harness dialogEvent={event} />
      </Provider>,
    );
    await screen.findByText(/4 of 4 selected/);
    return within(screen.getByRole("dialog", { hidden: true }));
  };

  it("adds and drops the event from the export, in step with the list", async () => {
    const dialog = await renderWithDialog(b);
    const include = dialog.getByRole("checkbox", { name: /include in “add to your calendar”/i, hidden: true });
    expect(include).toBeChecked();

    fireEvent.click(include);
    expect(screen.getByText(/3 of 4 selected/)).toBeInTheDocument();
    const inList = within(screen.getByRole("region", { name: "Add to Your Calendar" })).getByRole("checkbox", {
      name: /boba social/i,
    });
    expect(inList).not.toBeChecked();

    // And the other way: rechecking it in the list checks it in the dialog.
    fireEvent.click(inList);
    expect(include).toBeChecked();
  });

  it("offers a one-event download for any event, but no include box outside the export", async () => {
    const dialog = await renderWithDialog(later);
    expect(dialog.getByRole("link", { name: /download this event/i, hidden: true })).toHaveAttribute(
      "href",
      eventExportUrl(later),
    );
    expect(dialog.queryByRole("checkbox", { hidden: true })).not.toBeInTheDocument();
  });
});
