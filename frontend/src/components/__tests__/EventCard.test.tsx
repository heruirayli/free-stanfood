import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeEvent, renderWithApp } from "../../testUtils";
import EventCard from "../EventCard";

const BEFORE = new Date("2026-10-01T18:20:00Z"); // 11:20 AM PDT, 40 min before the event
const DURING = new Date("2026-10-01T19:15:00Z");
const NEAR_END = new Date("2026-10-01T19:40:00Z");

describe("EventCard", () => {
  it("leads with the food, then the title, time, place, and host", () => {
    renderWithApp(<EventCard event={makeEvent({ foodDetails: "pizza, snacks" })} now={BEFORE} />);

    expect(screen.getByText("Pizza, snacks")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pizza and pitch night" })).toBeInTheDocument();
    expect(screen.getByText("12:00 PM – 1:00 PM")).toBeInTheDocument();
    expect(screen.getByText("Starts in 40 min")).toBeInTheDocument();
    expect(screen.getByText("Y2E2 Building, Room 111")).toBeInTheDocument();
    expect(screen.getByText("Entrepreneurship Club")).toBeInTheDocument();
    expect(screen.getByText("Open to all")).toBeInTheDocument();
    expect(screen.getByText("Food listed")).toBeInTheDocument();
  });

  it("opens the event's details over the page", () => {
    renderWithApp(<EventCard event={makeEvent()} now={BEFORE} />);
    const link = screen.getByRole("link", { name: "Pizza and pitch night" });
    expect(link).toHaveAttribute("href", "/events/a1b2c3d4e5f6a7b8c9d0e1f2");
  });

  it("says how long ago it started, and when it's about to end", () => {
    const { unmount } = renderWithApp(<EventCard event={makeEvent()} now={DURING} />);
    expect(screen.getByText("Started 15 min ago")).toBeInTheDocument();
    unmount();
    renderWithApp(<EventCard event={makeEvent()} now={NEAR_END} />);
    expect(screen.getByText("Ends in 20 min")).toBeInTheDocument();
  });

  it("falls back to 'Free food' and shows medium confidence and RSVP", () => {
    renderWithApp(
      <EventCard event={makeEvent({ foodDetails: null, foodConfidence: 0.5, audience: "rsvp" })} now={BEFORE} />,
    );
    expect(screen.getByText("Free food")).toBeInTheDocument();
    expect(screen.getByText("Food likely")).toBeInTheDocument();
    expect(screen.getByText("RSVP required")).toBeInTheDocument();
  });

  it("leaves out a missing location and host", () => {
    renderWithApp(<EventCard event={makeEvent({ locationName: null, hostOrg: null })} now={BEFORE} />);
    expect(screen.queryByText("Y2E2 Building, Room 111")).not.toBeInTheDocument();
    expect(screen.queryByText("Entrepreneurship Club")).not.toBeInTheDocument();
  });
});
