import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Run in a zone far from campus, so anything that uses the viewer's zone instead
// of campus time fails here too, even on a Pacific machine. Node applies TZ at runtime.
process.env.TZ = "Asia/Tokyo";

afterEach(() => {
  cleanup();
});
