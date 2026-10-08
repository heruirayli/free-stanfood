import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeEvent, openDetails } from "../../testUtils";
import EventCard from "../EventCard";

const BEFORE = new Date("2026-10-01T16:00:00Z"); // 9 AM PDT, before the event
const DURING = new Date("2026-10-01T19:30:00Z");

describe("EventCard", () => {
  it("shows the key details and links to the original listing", () => {
    render(<EventCard event={makeEvent()} now={BEFORE} />);

    expect(screen.getByRole("heading", { name: "Pizza and pitch night" })).toBeInTheDocument();
    expect(screen.getByText("Today · 12:00 PM – 1:00 PM")).toBeInTheDocument();
    expect(screen.getByText("Y2E2 Building, Room 111")).toBeInTheDocument();
    expect(screen.getByText("Entrepreneurship Club")).toBeInTheDocument();
    expect(screen.getByText("pizza")).toBeInTheDocument();
    expect(screen.getByText("Food listed")).toBeInTheDocument();
    expect(screen.getByText("Open to all")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /view original listing/i });
    expect(link).toHaveAttribute("href", "https://events.stanford.edu/event/pizza-night");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("marks events that are happening now", () => {
    render(<EventCard event={makeEvent()} now={DURING} />);
    expect(screen.getByText("Happening now")).toBeInTheDocument();
  });

  it("shows medium confidence, RSVP, and audience notes", () => {
    render(
      <EventCard
        event={makeEvent({ foodConfidence: 0.5, audience: "rsvp", audienceNote: "Students" })}
        now={BEFORE}
      />,
    );
    expect(screen.getByText("Food likely")).toBeInTheDocument();
    expect(screen.getByText("RSVP required")).toBeInTheDocument();
    expect(screen.getByText("Intended for: Students")).toBeInTheDocument();
    expect(screen.queryByText("Happening now")).not.toBeInTheDocument();
  });

  it("renders the description only once Details is opened", () => {
    render(<EventCard event={makeEvent({ description: "Pizza in the lobby after the talk." })} now={BEFORE} />);
    expect(screen.queryByText("Pizza in the lobby after the talk.")).not.toBeInTheDocument();
    act(() => openDetails(screen.getByText("Details")));
    expect(screen.getByText("Pizza in the lobby after the talk.")).toBeInTheDocument();
  });

  it("renders descriptions as text, never as HTML", () => {
    render(<EventCard event={makeEvent({ description: "<img src=x onerror=alert(1)>" })} now={BEFORE} />);
    act(() => openDetails(screen.getByText("Details")));
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
