import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import { reloadSaved } from "./features/saved/savedEvents";

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

// Pages load their code on demand, which can take more than the default second
// when the whole suite runs at once.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
  // Saved events live in localStorage; each test starts with none.
  localStorage.clear();
  reloadSaved();
});
