import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithApp } from "../../testUtils";
import EventFilters from "../EventFilters";

describe("the calendar's time filter", () => {
  const box = (name: string | RegExp) => screen.getByRole("checkbox", { name });

  it("starts at any time, and combines the times switched on", () => {
    const { store } = renderWithApp(<EventFilters scope="calendar" />);
    const times = () => store.getState().events.filters.timesOfDay;
    expect(box("Any time")).toBeChecked();
    expect(box(/^Morning/)).not.toBeChecked();

    fireEvent.click(box(/^Evening/));
    fireEvent.click(box(/^Morning/));
    expect(times()).toEqual(["morning", "evening"]);
    expect(box("Any time")).not.toBeChecked();

    // Switching one off keeps the other.
    fireEvent.click(box(/^Morning/));
    expect(times()).toEqual(["evening"]);
  });

  it("goes back to any time when the last time is switched off, or with Any time", () => {
    const { store } = renderWithApp(<EventFilters scope="calendar" />);
    const times = () => store.getState().events.filters.timesOfDay;

    fireEvent.click(box(/^Midday/));
    fireEvent.click(box(/^Midday/));
    expect(times()).toEqual([]);
    expect(box("Any time")).toBeChecked();

    fireEvent.click(box(/^Midday/));
    fireEvent.click(box(/^Afternoon/));
    fireEvent.click(box("Any time"));
    expect(times()).toEqual([]);
    expect(box("Any time")).toBeChecked();

    // Any time can't be switched off by itself: something has to be shown.
    fireEvent.click(box("Any time"));
    expect(box("Any time")).toBeChecked();
  });

  it("says which hours each time covers", () => {
    renderWithApp(<EventFilters scope="calendar" />);
    expect(box("Morning, before 11 AM")).toBeInTheDocument();
    expect(box("Evening, 5 PM and later")).toBeInTheDocument();
  });
});
