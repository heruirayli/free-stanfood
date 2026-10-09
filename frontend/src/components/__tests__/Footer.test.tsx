import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import eventService from "../../features/events/eventService";
import { renderWithApp } from "../../testUtils";
import Footer from "../Footer";

describe("Footer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says when the listings were last updated, in campus time", async () => {
    vi.spyOn(eventService, "getStatus").mockResolvedValue({ updatedAt: "2026-10-08T12:17:00.000Z" });
    renderWithApp(<Footer />);
    const time = await screen.findByText("Thursday, October 8 at 5:17 AM");
    expect(time).toHaveAttribute("dateTime", "2026-10-08T12:17:00.000Z");
    expect(time.closest("p")).toHaveTextContent("Listings last updated Thursday, October 8 at 5:17 AM.");
  });

  it("leaves the line out when the time isn't known", async () => {
    const status = vi.spyOn(eventService, "getStatus").mockRejectedValue(new Error("Network Error"));
    renderWithApp(<Footer />);
    await vi.waitFor(() => expect(status).toHaveBeenCalled());
    expect(screen.queryByText(/last updated/)).not.toBeInTheDocument();
  });
});
