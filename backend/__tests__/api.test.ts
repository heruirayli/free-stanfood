import { mkdtemp, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { serializeSnapshot } from "../models/eventSnapshot.js";
import { makePublished } from "./factories.js";

// The API end to end, on a free port, against a temporary snapshot.

const open = makePublished("open", { startTime: new Date("2099-10-01T19:00:00Z"), endTime: new Date("2099-10-01T20:00:00Z") });
const restricted = makePublished("restricted", {
  audience: "restricted",
  startTime: new Date("2099-10-01T19:00:00Z"),
  endTime: new Date("2099-10-01T20:00:00Z"),
});

const UPDATED_AT = new Date("2099-09-30T12:17:00.000Z");

let server: Server;
let base: string;

beforeAll(async () => {
  const file = path.join(await mkdtemp(path.join(tmpdir(), "api-")), "events.json");
  await writeFile(file, serializeSnapshot({ updatedAt: UPDATED_AT, events: [open, restricted] }), "utf8");
  server = createApp({ eventsFile: file, serveFrontend: false }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const get = async (route: string) => {
  const response = await fetch(`${base}${route}`);
  return { status: response.status, body: (await response.json()) as unknown };
};

describe("GET /api/events", () => {
  it("lists public events only", async () => {
    const { status, body } = await get("/api/events?from=2099-09-30&to=2099-10-03");
    expect(status).toBe(200);
    expect((body as { id: string }[]).map((event) => event.id)).toEqual([open.id]);
  });

  it("rejects dates that aren't ISO 8601 with a JSON 400", async () => {
    const { status, body } = await get("/api/events?from=October%201");
    expect(status).toBe(400);
    expect(body).toMatchObject({ message: expect.stringMatching(/from/) });
  });
});

describe("GET /api/events/status", () => {
  it("says when the listings last changed", async () => {
    const { status, body } = await get("/api/events/status");
    expect(status).toBe(200);
    expect(body).toEqual({ updatedAt: UPDATED_AT.toISOString() });
  });
});

describe("GET /api/events/:id", () => {
  it("returns a public event", async () => {
    const { status, body } = await get(`/api/events/${open.id}`);
    expect(status).toBe(200);
    expect(body).toMatchObject({ id: open.id });
  });

  it("never returns a restricted event, even by id", async () => {
    expect((await get(`/api/events/${restricted.id}`)).status).toBe(404);
  });

  it("rejects malformed ids with a 400", async () => {
    expect((await get("/api/events/not-an-id")).status).toBe(400);
  });
});

describe("GET /api/events/calendar.ics", () => {
  it("downloads an iCalendar file of public events", async () => {
    const response = await fetch(`${base}/api/events/calendar.ics?from=2099-09-30&to=2099-10-03`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/calendar/);
    expect(response.headers.get("content-disposition")).toMatch(/attachment; filename="free-stanfood.ics"/);
    const text = await response.text();
    expect(text).toContain(`UID:${open.id}@free-stanfood`);
    expect(text).not.toContain(restricted.id);
  });

  it("leaves out 'Food possible' matches unless asked", async () => {
    const weak = await fetch(`${base}/api/events/calendar.ics?from=2099-09-30&to=2099-10-03&minConfidence=0.95`);
    expect(await weak.text()).not.toContain("BEGIN:VEVENT");
  });

  it("exports only the chosen events, or all but the excluded ones", async () => {
    const range = "from=2099-09-30&to=2099-10-03";
    const only = await (await fetch(`${base}/api/events/calendar.ics?${range}&ids=${open.id}`)).text();
    expect(only).toContain(`UID:${open.id}@free-stanfood`);
    const none = await (await fetch(`${base}/api/events/calendar.ics?${range}&exclude=${open.id}`)).text();
    expect(none).not.toContain("BEGIN:VEVENT");
    // Asking for a restricted event by id still never exports it.
    const sneaky = await (await fetch(`${base}/api/events/calendar.ics?${range}&ids=${restricted.id}`)).text();
    expect(sneaky).not.toContain("BEGIN:VEVENT");
  });

  it("rejects bad query params with a JSON 400", async () => {
    expect((await fetch(`${base}/api/events/calendar.ics?from=soon`)).status).toBe(400);
    expect((await fetch(`${base}/api/events/calendar.ics?ids=not-an-id`)).status).toBe(400);
  });
});

describe("unknown API routes", () => {
  it("get a JSON 404", async () => {
    const { status, body } = await get("/api/nope");
    expect(status).toBe(404);
    expect(body).toMatchObject({ message: expect.stringMatching(/Not found/) });
  });
});
