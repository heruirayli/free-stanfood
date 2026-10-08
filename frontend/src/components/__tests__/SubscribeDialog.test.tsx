import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithApp } from "../../testUtils";
import Header from "../Header";

const FEED = `${window.location.origin}/api/events/calendar.ics`;

const openSubscribe = () => {
  renderWithApp(<Header />);
  fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));
  return screen.getByRole("dialog", { name: "Subscribe in Your Calendar" });
};

describe("Subscribe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the feed URL with Google and Apple instructions", () => {
    openSubscribe();
    expect(screen.getByLabelText("Calendar link")).toHaveValue(FEED);
    expect(screen.getByRole("heading", { name: "Google Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Apple Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the link in calendar/i })).toHaveAttribute(
      "href",
      FEED.replace(/^https?:/, "webcal:"),
    );
  });

  it("copies the URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    openSubscribe();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });
    expect(writeText).toHaveBeenCalledWith(FEED);
    expect(screen.getByText("Link copied.")).toBeInTheDocument();
  });

  it("selects the URL when copying isn't allowed", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    openSubscribe();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });
    expect(screen.getByText(/couldn’t copy automatically/i)).toBeInTheDocument();
  });

  it("closes from its Close button and with Escape", () => {
    const dialog = openSubscribe();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dialog).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    const again = screen.getByRole("dialog") as HTMLDialogElement;
    act(() => again.close()); // what Escape does
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
