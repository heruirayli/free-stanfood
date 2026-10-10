import { act, render, screen } from "@testing-library/react";
import { lazy, Suspense } from "react";
import { describe, expect, it } from "vitest";
import { notifyError, useToastsWanted } from "../notify";

const Toasts = lazy(() => import("../../components/Toasts"));

// As App does it: no toast container (or library) until the first toast.
const Host = () =>
  useToastsWanted() ? (
    <Suspense fallback={null}>
      <Toasts />
    </Suspense>
  ) : (
    <p>No toasts yet</p>
  );

describe("notifyError", () => {
  it("loads the toasts on the first error and shows it", async () => {
    render(<Host />);
    expect(screen.getByText("No toasts yet")).toBeInTheDocument();
    act(() => notifyError("Couldn’t load events."));
    expect(await screen.findByText("Couldn’t load events.")).toBeInTheDocument();
  });
});
