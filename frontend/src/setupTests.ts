import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Run in a zone far from campus, so anything that uses the viewer's zone instead
// of campus time fails here too, even on a Pacific machine. Node applies TZ at runtime.
process.env.TZ = "Asia/Tokyo";

// jsdom has no modal dialogs: open and close them, firing "close" as browsers do.
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  if (!this.open) return;
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

afterEach(() => {
  cleanup();
});
