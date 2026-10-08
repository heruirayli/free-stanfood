import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventExportUrl, exportUrl, useLoadCalendarExport } from "../../features/events/calendarExport";
import { setFilters } from "../../features/events/eventSlice";
import eventService from "../../features/events/eventService";
import { makeEvent, openDetails, renderWithApp } from "../../testUtils";
import type { FoodEvent } from "../../types/event";
import CalendarExport from "../CalendarExport";
import EventDetails from "../EventDetails";

const a = makeEvent({ id: "a".repeat(24), title: "Pizza night", startTime: "2026-10-08T01:00:00.000Z" });
const b = makeEvent({ id: "b".repeat(24), title: "Boba social", startTime: "2026-10-09T19:00:00.000Z" });
const c = makeEvent({ id: "c".repeat(24), title: "Taco Tuesday", startTime: "2026-10-13T19:00:00.000Z" });
const d = makeEvent({ id: "d".repeat(24), title: "Bagel break", startTime: "2026-10-09T22:00:00.000Z" });
// Shown on the calendar but outside the upcoming export (more than a year out).
const later = makeEvent({ id: "e".repeat(24), title: "Winter dinner", startTime: "2028-01-20T03:00:00.000Z" });

const NOW = new Date("2026-10-06T12:00:00Z");

describe("export URLs", () => {
  it("exports everything with no list by default", () => {
    expect(exportUrl([a, b, c], {}, false)).toBe("/api/events/calendar.ics");
  });

  it("sends whichever list is shorter", () => {
    expect(exportUrl([a, b, c], { [a.id]: true }, false)).toBe(`/api/events/calendar.ics?exclude=${a.id}`);
    expect(exportUrl([a, b, c], { [a.id]: true, [b.id]: true }, false)).toBe(`/api/events/calendar.ics?ids=${c.id}`);
  });

  it("asks for 'Food possible' matches when they're shown", () => {
    expect(exportUrl([a], {}, true)).toBe("/api/events/calendar.ics?minConfidence=0");
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

// The calendar page in miniature: it loads the choices, and an event's details
// (which open over it) share them with the export section.
const Harness = ({ detailsFor }: { detailsFor?: FoodEvent }) => {
  useLoadCalendarExport();
  return (
    <>
      <CalendarExport now={NOW} />
      {detailsFor && <EventDetails event={detailsFor} now={NOW} headingLevel="h2" />}
    </>
  );
};

const section = () => within(screen.getByRole("region", { name: "Add to Your Calendar" }));
const downloadLink = () => section().getByRole("link", { name: /download/i });

const renderExport = async (detailsFor?: FoodEvent, { open = true } = {}) => {
  const view = renderWithApp(<Harness detailsFor={detailsFor} />);
  await screen.findByText(/4 of 4 selected/);
  if (open) act(() => openDetails(screen.getByText(/of 4 selected/)));
  return view;
};

describe("CalendarExport", () => {
  beforeEach(() => {
    vi.spyOn(eventService, "getEvents").mockResolvedValue([a, b, d, c]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the event list only while 'Choose events' is open", async () => {
    await renderExport(undefined, { open: false });
    expect(section().queryAllByRole("checkbox")).toHaveLength(0);
    expect(downloadLink()).toHaveAttribute("href", "/api/events/calendar.ics");
    act(() => openDetails(screen.getByText(/of 4 selected/)));
    expect(section().getAllByRole("checkbox", { name: /^All events on/ })).toHaveLength(3);
  });

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
    const { store } = await renderExport();
    act(() => {
      store.dispatch(setFilters({ showLowConfidence: true }));
    });
    await screen.findByText(/4 of 4 selected/);
    expect(eventService.getEvents).toHaveBeenLastCalledWith({ minConfidence: 0 }, expect.any(AbortSignal));
    expect(downloadLink()).toHaveAttribute("href", "/api/events/calendar.ics?minConfidence=0");
  });

  it("frees the list when the calendar closes", async () => {
    const { store, unmount } = await renderExport();
    unmount();
    expect(store.getState().calendarExport).toMatchObject({ items: [], status: "idle" });
  });
});

describe("an event's details and the export", () => {
  beforeEach(() => {
    vi.spyOn(eventService, "getEvents").mockResolvedValue([a, b, d, c]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds and drops the event from the export, in step with the list", async () => {
    await renderExport(b);
    const include = screen.getByRole("checkbox", { name: /include in “add to your calendar”/i });
    expect(include).toBeChecked();

    fireEvent.click(include);
    expect(screen.getByText(/3 of 4 selected/)).toBeInTheDocument();
    const inList = section().getByRole("checkbox", { name: /boba social/i });
    expect(inList).not.toBeChecked();

    // And the other way: rechecking it in the list checks it in the details.
    fireEvent.click(inList);
    expect(include).toBeChecked();
  });

  it("offers a one-event download for any event, but no include box outside the export", async () => {
    await renderExport(later);
    expect(screen.getByRole("link", { name: /add to calendar/i })).toHaveAttribute("href", eventExportUrl(later));
    expect(screen.queryByRole("checkbox", { name: /include in/i })).not.toBeInTheDocument();
  });

  it("has no include box when no calendar page is open", () => {
    renderWithApp(<EventDetails event={b} now={NOW} headingLevel="h1" />);
    expect(screen.getByRole("link", { name: /add to calendar/i })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
