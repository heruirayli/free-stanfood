import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Header from "../../../components/Header";
import EventCard from "../../../components/EventCard";
import { makeEvent, renderWithApp } from "../../../testUtils";
import { reloadSaved, removeSaved, toggleSaved, useSavedEvents } from "../savedEvents";

const KEY = "free-stanfood:saved";
const lunch = makeEvent({ id: "a".repeat(24), title: "Pizza and pitch night", startTime: "2099-10-01T19:00:00.000Z" });
const boba = makeEvent({ id: "b".repeat(24), title: "Boba social", startTime: "2099-10-02T19:00:00.000Z" });

const Count = () => <output aria-label="saved">{useSavedEvents().map((e) => e.title).join(", ")}</output>;
const saved = () => screen.getByRole("status", { name: "saved" }).textContent;

describe("saved events", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves and unsaves, keeping them in localStorage", () => {
    render(<Count />);
    act(() => toggleSaved(lunch));
    act(() => toggleSaved(boba));
    expect(saved()).toBe("Pizza and pitch night, Boba social");
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toEqual([
      { id: lunch.id, title: lunch.title, startTime: lunch.startTime, endTime: lunch.endTime },
      { id: boba.id, title: boba.title, startTime: boba.startTime, endTime: boba.endTime },
    ]);
    act(() => toggleSaved(lunch));
    expect(saved()).toBe("Boba social");
    act(() => removeSaved(new Set([boba.id])));
    expect(saved()).toBe("");
  });

  it("drops saved events a day after they're over", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "old", title: "Last week", startTime: "2020-01-01T19:00:00.000Z", endTime: "2020-01-01T20:00:00.000Z" },
        { id: lunch.id, title: lunch.title, startTime: lunch.startTime, endTime: null },
      ]),
    );
    reloadSaved();
    render(<Count />);
    expect(saved()).toBe("Pizza and pitch night");
  });

  it("starts empty when storage holds something else", () => {
    localStorage.setItem(KEY, "{not json");
    reloadSaved();
    render(<Count />);
    expect(saved()).toBe("");
    localStorage.setItem(KEY, JSON.stringify([{ id: 1 }, "x", null]));
    act(() => reloadSaved());
    expect(saved()).toBe("");
  });

  it("stars a card, and the header counts it", () => {
    renderWithApp(
      <>
        <Header />
        <EventCard event={lunch} now={new Date("2099-10-01T16:00:00Z")} />
      </>,
    );
    const star = screen.getByRole("button", { name: "Save Pizza and pitch night" });
    expect(star).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("link", { name: "Saved events" })).toHaveAttribute("href", "/saved");

    fireEvent.click(star);
    expect(star).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Saved events, 1" })).toBeInTheDocument();

    fireEvent.click(star);
    expect(star).toHaveAttribute("aria-pressed", "false");
  });
});
