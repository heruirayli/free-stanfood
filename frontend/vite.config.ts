/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read the shared root .env, but only expose HOST_REMOVAL_EMAIL (and VITE_*) to
  // the browser. Other settings (API keys, the scraper's contact email) never match these prefixes.
  envDir: "..",
  envPrefix: ["VITE_", "HOST_REMOVAL_"],
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
});
