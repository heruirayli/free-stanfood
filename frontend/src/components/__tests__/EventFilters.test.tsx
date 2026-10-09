import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithApp } from "../../testUtils";
import EventFilters from "../EventFilters";

describe("the calendar's time filter", () => {
  const box = (name: string | RegExp) => screen.getByRole("checkbox", { name });

  it("starts with every time off, meaning any time, and combines the ones switched on", () => {
    const { store } = renderWithApp(<EventFilters scope="calendar" />);
    const times = () => store.getState().events.filters.timesOfDay;
    expect(screen.queryByRole("checkbox", { name: "Any time" })).not.toBeInTheDocument();
    expect(box(/^Morning/)).not.toBeChecked();
    expect(times()).toEqual([]);

    fireEvent.click(box(/^Evening/));
    fireEvent.click(box(/^Morning/));
    expect(times()).toEqual(["morning", "evening"]);

    // Switching one off keeps the other; switching the last off is any time again.
    fireEvent.click(box(/^Morning/));
    expect(times()).toEqual(["evening"]);
    fireEvent.click(box(/^Evening/));
    expect(times()).toEqual([]);
  });

  it("says which hours each time covers", () => {
    renderWithApp(<EventFilters scope="calendar" />);
    expect(box("Morning, before 11 AM")).toBeInTheDocument();
    expect(box("Evening, 5 PM and later")).toBeInTheDocument();
  });
});
