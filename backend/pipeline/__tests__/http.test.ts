import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FileResponseCache,
  HostRateLimiter,
  HttpError,
  MemoryResponseCache,
  buildUserAgent,
  createHttpClient,
  parseRetryAfter,
} from "../http.js";

// A fake clock where sleeping advances time instantly.
const fakeClock = () => {
  let time = 1_000_000;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
    sleeps,
  };
};

type Reply = { status: number; body?: string; headers?: Record<string, string> } | Error;

const fakeFetch = (replies: Reply[]) => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), headers: { ...(init?.headers as Record<string, string>) } });
    const reply = replies.shift();
    if (!reply) throw new Error("no more replies");
    if (reply instanceof Error) throw reply;
    return new Response(reply.status === 304 ? null : (reply.body ?? ""), {
      status: reply.status,
      headers: reply.headers,
    });
  }) as typeof fetch;
  return { impl, calls };
};

const client = (replies: Reply[], extra: Partial<Parameters<typeof createHttpClient>[0]> = {}) => {
  const clock = fakeClock();
  const fetch = fakeFetch(replies);
  const http = createHttpClient({
    contactEmail: "dev@example.com",
    fetchImpl: fetch.impl,
    sleep: clock.sleep,
    now: clock.now,
    ...extra,
  });
  return { http, clock, calls: fetch.calls };
};

describe("buildUserAgent", () => {
  it("includes the contact email", () => {
    expect(buildUserAgent("dev@example.com")).toMatch(/free-stanfood\/.+contact: dev@example\.com/);
  });

  it("rejects a missing or invalid email", () => {
    expect(() => buildUserAgent("")).toThrow();
    expect(() => buildUserAgent("not-an-email")).toThrow();
  });
});

describe("createHttpClient", () => {
  it("sends the User-Agent and returns the body", async () => {
    const { http, calls } = client([{ status: 200, body: "ok" }]);
    const response = await http.getText("https://a.example/x");
    expect(response).toMatchObject({ status: 200, body: "ok", notModified: false });
    expect(calls[0]?.headers["User-Agent"]).toContain("dev@example.com");
  });

  it("spaces requests to the same host at least one second apart", async () => {
    const { http, clock } = client([
      { status: 200 },
      { status: 200 },
      { status: 200 },
    ]);
    await http.getText("https://a.example/1");
    await http.getText("https://a.example/2");
    await http.getText("https://b.example/1");
    // Only the second request to a.example had to wait.
    expect(clock.sleeps).toEqual([1000]);
  });

  it("retries 429 and 5xx with exponential backoff", async () => {
    const { http, clock, calls } = client(
      [{ status: 503 }, { status: 429 }, { status: 200, body: "ok" }],
      { minIntervalMs: 0, baseBackoffMs: 100 },
    );
    const response = await http.getText("https://a.example/x");
    expect(response.body).toBe("ok");
    expect(calls).toHaveLength(3);
    expect(clock.sleeps).toEqual([100, 200]);
  });

  it("honors Retry-After", async () => {
    const { http, clock } = client(
      [{ status: 429, headers: { "Retry-After": "7" } }, { status: 200 }],
      { minIntervalMs: 0 },
    );
    await http.getText("https://a.example/x");
    expect(clock.sleeps).toEqual([7000]);
  });

  it("gives up when Retry-After is longer than the backoff cap", async () => {
    const { http, calls } = client([{ status: 429, headers: { "Retry-After": "3600" } }], {
      minIntervalMs: 0,
    });
    await expect(http.getText("https://a.example/x")).rejects.toBeInstanceOf(HttpError);
    expect(calls).toHaveLength(1);
  });

  it("stops asking a host that wants a longer wait for the rest of the run", async () => {
    const { http, calls } = client([{ status: 429, headers: { "Retry-After": "3600" } }, { status: 200 }], {
      minIntervalMs: 0,
    });
    await expect(http.getText("https://a.example/x")).rejects.toBeInstanceOf(HttpError);
    await expect(http.getText("https://a.example/y")).rejects.toThrow(/asked us to retry later/);
    expect(calls).toHaveLength(1);
  });

  it("makes the next URL on the host wait out a Retry-After too", async () => {
    const { http, clock } = client([{ status: 429, headers: { "Retry-After": "7" } }, { status: 200, body: "ok" }], {
      minIntervalMs: 0,
      maxRetries: 0,
    });
    await expect(http.getText("https://a.example/x")).rejects.toMatchObject({ status: 429 });
    expect((await http.getText("https://a.example/y")).body).toBe("ok");
    expect(clock.sleeps).toEqual([7000]);
  });

  it("retries a response whose body fails mid-read", async () => {
    let attempts = 0;
    const fetchImpl = (async () => {
      attempts++;
      if (attempts === 1) return { status: 200, ok: true, headers: new Headers(), text: () => Promise.reject(new TypeError("terminated")) };
      return new Response("ok");
    }) as unknown as typeof fetch;
    const { http } = client([], { fetchImpl, minIntervalMs: 0, baseBackoffMs: 1 });
    expect((await http.getText("https://a.example/x")).body).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("stops after maxRetries", async () => {
    const { http, calls } = client([{ status: 500 }, { status: 500 }, { status: 500 }], {
      minIntervalMs: 0,
      maxRetries: 2,
      baseBackoffMs: 1,
    });
    await expect(http.getText("https://a.example/x")).rejects.toMatchObject({ status: 500 });
    expect(calls).toHaveLength(3);
  });

  it("does not retry other 4xx responses", async () => {
    const { http, calls } = client([{ status: 404, body: "missing" }]);
    await expect(http.getText("https://a.example/x")).rejects.toMatchObject({
      status: 404,
      body: "missing",
    });
    expect(calls).toHaveLength(1);
  });

  it("retries network errors", async () => {
    const { http, calls } = client([new TypeError("fetch failed"), { status: 200, body: "ok" }], {
      minIntervalMs: 0,
      baseBackoffMs: 1,
    });
    expect((await http.getText("https://a.example/x")).body).toBe("ok");
    expect(calls).toHaveLength(2);
  });

  it("makes conditional requests and serves the cached body on 304", async () => {
    const cache = new MemoryResponseCache();
    const { http, calls } = client(
      [
        { status: 200, body: "fresh", headers: { ETag: 'W/"abc"', "Last-Modified": "Mon, 28 Sep 2026 10:00:00 GMT" } },
        { status: 304 },
      ],
      { cache, minIntervalMs: 0 },
    );
    await http.getText("https://a.example/x");
    const second = await http.getText("https://a.example/x");
    expect(calls[1]?.headers["If-None-Match"]).toBe('W/"abc"');
    expect(calls[1]?.headers["If-Modified-Since"]).toBe("Mon, 28 Sep 2026 10:00:00 GMT");
    expect(second).toMatchObject({ status: 304, body: "fresh", notModified: true });
  });
});

describe("FileResponseCache", () => {
  it("keeps the validators of URLs used this run across processes", async () => {
    const file = path.join(await mkdtemp(path.join(tmpdir(), "http-cache-")), "cache.json");
    const first = await FileResponseCache.load(file);
    first.set("https://a.example/feed", { etag: '"v1"', lastModified: null, body: "cal" });
    first.set("https://a.example/no-validators", { etag: null, lastModified: null, body: "x" });
    await first.save();

    const second = await FileResponseCache.load(file);
    expect(second.get("https://a.example/feed")).toEqual({ etag: '"v1"', lastModified: null, body: "cal" });
    expect(second.get("https://a.example/no-validators")).toBeUndefined();
    await second.save();
    // Unused entries are pruned; a corrupt file starts cold.
    const third = await FileResponseCache.load(file);
    await third.save();
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({});
    await writeFile(file, "{not json", "utf8");
    expect((await FileResponseCache.load(file)).get("https://a.example/feed")).toBeUndefined();
  });
});

describe("HostRateLimiter", () => {
  it("reserves distinct slots for concurrent callers", async () => {
    // Frozen clock: all three callers arrive at the same instant.
    const sleeps: number[] = [];
    const limiter = new HostRateLimiter(1000, () => 0, async (ms) => {
      sleeps.push(ms);
    });
    await Promise.all([limiter.wait("a"), limiter.wait("a"), limiter.wait("a")]);
    expect(sleeps).toEqual([1000, 2000]);
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds and HTTP dates", () => {
    expect(parseRetryAfter("5", 0)).toBe(5000);
    const now = Date.parse("2026-09-28T10:00:00Z");
    expect(parseRetryAfter("Mon, 28 Sep 2026 10:00:30 GMT", now)).toBe(30_000);
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter("soon", now)).toBeNull();
  });
});
