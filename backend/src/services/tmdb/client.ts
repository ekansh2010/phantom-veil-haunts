import { tmdbCredentials } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

export const TMDB_API_BASE = "https://api.themoviedb.org/3";

export type TmdbParams = Record<string, string | number | boolean | undefined>;

export interface TmdbCredentials {
  /** v4 API Read Access Token (Authorization: Bearer). Preferred. */
  readToken?: string;
  /** v3 API key (api_key query param). */
  apiKey?: string;
}

/** A non-retryable TMDB failure (4xx other than 429), or retries exhausted. */
export class TmdbError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

export class TmdbNotConfiguredError extends Error {
  constructor() {
    super("TMDB is not configured (set TMDB_READ_TOKEN or TMDB_API_KEY)");
    this.name = "TmdbNotConfiguredError";
  }
}

type Sleep = (ms: number) => Promise<void>;
const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sliding-window limiter: at most `limit` requests start in any `windowMs`.
 * Shared by every client in the process, so the sync job and on-demand detail
 * fetches stay under TMDB's limits together.
 */
export class RateLimiter {
  private stamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: Sleep = realSleep,
  ) {}

  async acquire(): Promise<void> {
    for (;;) {
      const t = this.now();
      while (this.stamps.length && this.stamps[0] <= t - this.windowMs) this.stamps.shift();
      if (this.stamps.length < this.limit) {
        this.stamps.push(t);
        return;
      }
      await this.sleep(this.stamps[0] + this.windowMs - t + 5);
    }
  }
}

/** ~35 requests / 10 s: comfortably below TMDB's published limits (unthrottled under test). */
const sharedLimiter = new RateLimiter(process.env.NODE_ENV === "test" ? 100_000 : 35, 10_000);

export interface TmdbClientOptions {
  credentials: TmdbCredentials;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  limiter?: RateLimiter;
  maxRetries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  baseUrl?: string;
}

const RETRYABLE = (status: number) => status === 429 || status >= 500;

export class TmdbClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: Sleep;
  private readonly limiter: RateLimiter;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly baseDelayMs: number;
  private readonly baseUrl: string;

  constructor(private readonly options: TmdbClientOptions) {
    if (!options.credentials.readToken && !options.credentials.apiKey) throw new TmdbNotConfiguredError();
    // Resolve global fetch lazily so test stubs installed later are honoured.
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? realSleep;
    this.limiter = options.limiter ?? sharedLimiter;
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.baseUrl = options.baseUrl ?? TMDB_API_BASE;
  }

  /** Builds the request URL. The v3 key goes in the query; a v4 token goes in a header. */
  buildUrl(path: string, params: TmdbParams = {}): string {
    const url = new URL(this.baseUrl + (path.startsWith("/") ? path : `/${path}`));
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    if (!this.options.credentials.readToken && this.options.credentials.apiKey) url.searchParams.set("api_key", this.options.credentials.apiKey);
    return url.toString();
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.options.credentials.readToken) h.Authorization = `Bearer ${this.options.credentials.readToken}`;
    return h;
  }

  private backoff(attempt: number): number {
    return this.baseDelayMs * 2 ** attempt + Math.floor(Math.random() * this.baseDelayMs);
  }

  /** GET a TMDB endpoint with rate limiting, a timeout, and retries on 429/5xx/network errors. */
  async get<T>(path: string, params: TmdbParams = {}): Promise<T> {
    const url = this.buildUrl(path, params);
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.limiter.acquire();
      let res: Response;
      try {
        res = await this.fetchImpl(url, { headers: this.headers(), signal: AbortSignal.timeout(this.timeoutMs) });
      } catch (err) {
        // Network failure or timeout: retry with backoff.
        lastError = err;
        if (attempt < this.maxRetries) await this.sleep(this.backoff(attempt));
        continue;
      }

      if (res.ok) return (await res.json()) as T;

      if (!RETRYABLE(res.status)) {
        // Never echo the URL: it may carry the api_key.
        throw new TmdbError(res.status, `TMDB ${path} failed with HTTP ${res.status}`);
      }

      lastError = new TmdbError(res.status, `TMDB ${path} failed with HTTP ${res.status}`);
      if (attempt < this.maxRetries) {
        const retryAfter = Number(res.headers?.get?.("retry-after"));
        const wait = res.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : this.backoff(attempt);
        logger.debug(`TMDB ${path} -> ${res.status}; retrying in ${wait}ms`);
        await this.sleep(wait);
      }
    }

    if (lastError instanceof TmdbError) throw lastError;
    throw new TmdbError(0, `TMDB ${path} failed: ${lastError instanceof Error ? lastError.message : "network error"}`);
  }

  /** Like get(), but resolves null for 404 (unknown id). */
  async getOrNull<T>(path: string, params: TmdbParams = {}): Promise<T | null> {
    try {
      return await this.get<T>(path, params);
    } catch (err) {
      if (err instanceof TmdbError && err.status === 404) return null;
      throw err;
    }
  }
}

/** Client using the configured env credentials, or null when TMDB isn't configured. */
export const createTmdbClient = (overrides: Partial<TmdbClientOptions> = {}): TmdbClient | null => {
  const credentials = overrides.credentials ?? tmdbCredentials();
  if (!credentials) return null;
  return new TmdbClient({ ...overrides, credentials });
};
