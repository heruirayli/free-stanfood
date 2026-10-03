import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// Polite HTTP client for source adapters:
// - descriptive User-Agent with a contact email (from SCRAPER_CONTACT_EMAIL)
// - at most one request per `minIntervalMs` per host (default 1 req/s)
// - exponential backoff on 429 / 5xx / network errors, honoring Retry-After for
//   every request to that host, not just the one that got it
// - conditional requests (If-None-Match / If-Modified-Since) via a response cache,
//   kept on disk between runs (FileResponseCache)

export const USER_AGENT_PRODUCT = "free-stanfood/0.1";

export interface CachedResponse {
  etag: string | null;
  lastModified: string | null;
  body: string;
}

export interface ResponseCache {
  get(url: string): CachedResponse | undefined;
  set(url: string, entry: CachedResponse): void;
}

export class MemoryResponseCache implements ResponseCache {
  protected readonly entries = new Map<string, CachedResponse>();

  get(url: string): CachedResponse | undefined {
    return this.entries.get(url);
  }

  set(url: string, entry: CachedResponse): void {
    this.entries.set(url, entry);
  }
}

const cacheFileSchema = z.record(
  z.string(),
  z.object({ etag: z.string().nullable(), lastModified: z.string().nullable(), body: z.string() }),
);

// Validators only help if they outlive the process: each run requests every URL
// once. Saves only the URLs this run used, so dated URLs don't pile up.
export class FileResponseCache extends MemoryResponseCache {
  private readonly used = new Set<string>();

  private constructor(private readonly file: string) {
    super();
  }

  // A missing or unreadable cache file just means starting cold.
  static async load(file: string): Promise<FileResponseCache> {
    const cache = new FileResponseCache(file);
    try {
      const parsed = cacheFileSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
      if (parsed.success) for (const [url, entry] of Object.entries(parsed.data)) cache.entries.set(url, entry);
    } catch {
      // Cold start.
    }
    return cache;
  }

  override get(url: string): CachedResponse | undefined {
    this.used.add(url);
    return super.get(url);
  }

  override set(url: string, entry: CachedResponse): void {
    this.used.add(url);
    super.set(url, entry);
  }

  async save(): Promise<void> {
    const kept = Object.fromEntries([...this.used].flatMap((url) => {
      const entry = this.entries.get(url);
      return entry && (entry.etag || entry.lastModified) ? [[url, entry]] : [];
    }));
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(kept), "utf8");
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string,
  ) {
    super(`HTTP ${status} from ${url}`);
    this.name = "HttpError";
  }
}

export interface HttpResponse {
  url: string;
  status: number;
  body: string;
  notModified: boolean;
}

export interface HttpClient {
  getText(url: string, options?: { accept?: string }): Promise<HttpResponse>;
}

export interface HttpClientOptions {
  contactEmail: string;
  fetchImpl?: typeof fetch;
  minIntervalMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
  cache?: ResponseCache;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const buildUserAgent = (contactEmail: string): string => {
  const email = z.email().safeParse(contactEmail.trim());
  if (!email.success) {
    throw new Error("SCRAPER_CONTACT_EMAIL must be a valid email address.");
  }
  return `${USER_AGENT_PRODUCT} (unofficial student project; contact: ${email.data})`;
};

// Reserves request slots per host so concurrent callers are also spaced out.
export class HostRateLimiter {
  private readonly nextSlot = new Map<string, number>();

  constructor(
    private readonly minIntervalMs: number,
    private readonly now: () => number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  async wait(host: string): Promise<void> {
    const now = this.now();
    const slot = Math.max(now, this.nextSlot.get(host) ?? 0);
    this.nextSlot.set(host, slot + this.minIntervalMs);
    if (slot > now) {
      await this.sleep(slot - now);
    }
  }

  // Holds every later request to the host back by `ms` (a Retry-After or backoff).
  defer(host: string, ms: number): void {
    this.nextSlot.set(host, Math.max(this.nextSlot.get(host) ?? 0, this.now() + ms));
  }
}

const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

// Returns delay in ms, or null when Retry-After is absent or unparseable.
export const parseRetryAfter = (header: string | null, now: number): number | null => {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
};

export const createHttpClient = (options: HttpClientOptions): HttpClient => {
  const userAgent = buildUserAgent(options.contactEmail);
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? 4;
  const baseBackoffMs = options.baseBackoffMs ?? 2000;
  const maxBackoffMs = options.maxBackoffMs ?? 60_000;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const cache = options.cache;
  const limiter = new HostRateLimiter(options.minIntervalMs ?? 1000, now, sleep);
  // Hosts that asked us to stay away longer than one run will wait: skipped until the next run.
  const blockedHosts = new Set<string>();

  const backoff = (attempt: number): number =>
    Math.min(maxBackoffMs, baseBackoffMs * 2 ** attempt);

  const getText = async (
    url: string,
    { accept = "application/json" }: { accept?: string } = {},
  ): Promise<HttpResponse> => {
    const host = new URL(url).host;
    const cached = cache?.get(url);

    for (let attempt = 0; ; attempt++) {
      if (blockedHosts.has(host)) throw new Error(`${host} asked us to retry later; skipping ${url} this run`);
      await limiter.wait(host);

      const headers: Record<string, string> = { "User-Agent": userAgent, Accept: accept };
      if (cached?.etag) headers["If-None-Match"] = cached.etag;
      if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

      // A dropped connection or timeout, while connecting or mid-body, is retried.
      let response: Response;
      let body: string;
      try {
        response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
        if (response.status === 304 && cached) {
          return { url, status: 304, body: cached.body, notModified: true };
        }
        body = await response.text();
      } catch (error) {
        if (attempt >= maxRetries) {
          throw new Error(`Request to ${url} failed after ${attempt + 1} attempts`, {
            cause: error,
          });
        }
        await sleep(backoff(attempt));
        continue;
      }

      if (response.ok) {
        cache?.set(url, {
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          body,
        });
        return { url, status: response.status, body, notModified: false };
      }

      if (!isRetryableStatus(response.status)) {
        throw new HttpError(response.status, url, body);
      }

      const retryAfter = parseRetryAfter(response.headers.get("retry-after"), now());
      if (retryAfter !== null && retryAfter > maxBackoffMs) {
        // The server asked us to stay away longer than we are willing to wait
        // inside one run. Give up on the host rather than retry early.
        blockedHosts.add(host);
        throw new HttpError(response.status, url, body);
      }
      // The next attempt, and any other URL on this host, waits out the delay,
      // even when this request has used up its retries.
      limiter.defer(host, retryAfter ?? backoff(attempt));
      if (attempt >= maxRetries) throw new HttpError(response.status, url, body);
    }
  };

  return { getText };
};
