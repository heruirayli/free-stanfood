import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeEvent, renderWithApp } from "../../testUtils";
import EventDetails from "../EventDetails";

const NOW = new Date("2026-10-01T19:40:00Z"); // 12:40 PM PDT, 20 min before the end

describe("EventDetails", () => {
  it("shows everything about the event", () => {
    renderWithApp(
      <EventDetails
        event={makeEvent({ audienceNote: "Students", cost: "Free for members", description: "Pizza in the lobby." })}
        now={NOW}
        headingLevel="h1"
      />,
    );
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Pizza and pitch night" })).toBeInTheDocument();
    expect(screen.getByText("Today · 12:00 PM – 1:00 PM")).toBeInTheDocument();
    expect(screen.getByText("Ends in 20 min")).toBeInTheDocument();
    expect(screen.getByText("Y2E2 Building, Room 111")).toBeInTheDocument();
    expect(screen.getByText("Entrepreneurship Club")).toBeInTheDocument();
    expect(screen.getByText("Intended for: Students")).toBeInTheDocument();
    expect(screen.getByText("Free for members")).toBeInTheDocument();
    expect(screen.getByText("Pizza in the lobby.")).toBeInTheDocument();
    expect(screen.getByText("Open to all")).toBeInTheDocument();
    expect(screen.getByText("Food listed")).toBeInTheDocument();
  });

  it("links to the original listing in a new tab", () => {
    renderWithApp(<EventDetails event={makeEvent()} now={NOW} headingLevel="h2" />);
    const link = screen.getByRole("link", { name: /view original event/i });
    expect(link).toHaveAttribute("href", "https://events.stanford.edu/event/pizza-night");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("says when a location isn't listed", () => {
    renderWithApp(<EventDetails event={makeEvent({ locationName: null })} now={NOW} headingLevel="h2" />);
    expect(screen.getByText(/not listed/i)).toBeInTheDocument();
  });

  it("renders descriptions as text, never as HTML", () => {
    renderWithApp(
      <EventDetails event={makeEvent({ description: "<img src=x onerror=alert(1)>" })} now={NOW} headingLevel="h2" />,
    );
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
