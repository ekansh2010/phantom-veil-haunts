import { describe, expect, it, vi } from "vitest";
import { RateLimiter, TmdbClient, TmdbError, TmdbNotConfiguredError } from "../../src/services/tmdb/client";
import { jsonResponse } from "../tmdbMock";

const noLimit = new RateLimiter(1_000_000, 10_000);

const makeClient = (fetchImpl: ReturnType<typeof vi.fn>, creds: { readToken?: string; apiKey?: string } = { readToken: "tok" }) => {
  const sleep = vi.fn(async (_ms: number) => undefined);
  const client = new TmdbClient({ credentials: creds, fetchImpl: fetchImpl as unknown as typeof fetch, sleep, limiter: noLimit, baseDelayMs: 100 });
  return { client, sleep };
};

describe("TmdbClient", () => {
  it("refuses to build without credentials", () => {
    expect(() => new TmdbClient({ credentials: {} })).toThrow(TmdbNotConfiguredError);
  });

  it("sends a v4 read token as a Bearer header and never in the URL", async () => {
    const f = vi.fn(async () => jsonResponse({ ok: 1 }));
    const { client } = makeClient(f, { readToken: "secret-token" });
    expect(await client.get("/discover/movie", { page: 2, empty: "", skip: undefined })).toEqual({ ok: 1 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.themoviedb.org/3/discover/movie?page=2");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });

  it("sends a v3 key as the api_key query param", async () => {
    const f = vi.fn(async () => jsonResponse({}));
    const { client } = makeClient(f, { apiKey: "k3y" });
    await client.get("movie/1");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.themoviedb.org/3/movie/1?api_key=k3y");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("retries 429 honouring Retry-After, then succeeds", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ results: [1] }));
    const { client, sleep } = makeClient(f);
    expect(await client.get("/x")).toEqual({ results: [1] });
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls[0][0]).toBe(2000);
    expect(sleep.mock.calls[1][0]).toBeGreaterThanOrEqual(200); // exponential backoff (attempt 1)
  });

  it("retries 5xx and network errors, then gives up with a TmdbError", async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValue(jsonResponse({}, 503));
    const { client, sleep } = makeClient(f);
    const err = (await client.get("/x").catch((e: unknown) => e)) as TmdbError;
    expect(err).toBeInstanceOf(TmdbError);
    expect(err.status).toBe(503);
    expect(f).toHaveBeenCalledTimes(4); // 1 + 3 retries
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it("does not retry other 4xx errors and never leaks the key in messages", async () => {
    const f = vi.fn(async () => jsonResponse({}, 401));
    const { client } = makeClient(f, { apiKey: "super-secret" });
    const err = (await client.get("/x").catch((e: unknown) => e)) as TmdbError;
    expect(err.status).toBe(401);
    expect(err.message).not.toContain("super-secret");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("getOrNull resolves null for 404 only", async () => {
    const { client } = makeClient(vi.fn(async () => jsonResponse({}, 404)));
    expect(await client.getOrNull("/movie/0")).toBeNull();
    const { client: c2 } = makeClient(vi.fn(async () => jsonResponse({}, 400)));
    await expect(c2.getOrNull("/movie/0")).rejects.toBeInstanceOf(TmdbError);
  });
});

describe("RateLimiter", () => {
  it("delays requests beyond the window limit", async () => {
    let t = 0;
    const sleeps: number[] = [];
    const limiter = new RateLimiter(2, 10_000, () => t, async (ms) => {
      sleeps.push(ms);
      t += ms;
    });
    await limiter.acquire();
    await limiter.acquire();
    expect(sleeps).toEqual([]);
    await limiter.acquire();
    expect(sleeps).toEqual([10_005]);
  });
});
