/// <reference types="vitest/config" />
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The root .env belongs to the Express server. Read only the values the frontend
// needs from it, rather than pointing envDir at it: Vite would also pick up its
// NODE_ENV=development and turn `vite build` into a development build. Real
// environment variables (e.g. on the host) take precedence over the file.
const rootEnvPath = fileURLToPath(new URL("../.env", import.meta.url));
const rootEnv = existsSync(rootEnvPath) ? parseEnv(readFileSync(rootEnvPath, "utf8")) : {};
const env = (key: string): string | undefined => process.env[key] ?? rootEnv[key];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Only HOST_REMOVAL_EMAIL (and VITE_* from frontend/.env) reach the browser.
  // API keys and the scraper's contact email are never exposed.
  define: {
    "import.meta.env.HOST_REMOVAL_EMAIL": JSON.stringify(env("HOST_REMOVAL_EMAIL") ?? ""),
  },
  server: {
    proxy: {
      // Same port the Express server listens on (PORT in the root .env).
      "/api": `http://localhost:${env("PORT") || 5000}`,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    // A file's first test also pays for loading its modules into jsdom, which can
    // pass 5 seconds when the suite runs in parallel on a busy machine.
    testTimeout: 15_000,
  },
});
