import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseImportArgs, runImport } from "../../scripts/import-tmdb";
import { env } from "../../src/config/env";
import { Movie, SyncState, WatchlistEntry } from "../../src/models";
import { buildPlan, runTmdbSync, upsertTmdbMovies } from "../../src/services/tmdb/sync.service";
import { mapTmdbListItem } from "../../src/services/tmdb/mappers";
import { api, auth, registerUser, seedCatalog } from "../helpers";
import { calledPaths, createTmdbFetch, fixture, jsonResponse } from "../tmdbMock";

const discover = fixture("discover-page1.json");
const details = fixture("movie-493922.json");

/** Discover returns the fixture page for page 1 of every list, nothing afterwards. */
const discoverRoute = (url: URL) => jsonResponse(url.searchParams.get("page") === "1" ? discover : { page: 2, results: [] });

describe("TMDB library (configured)", () => {
  let fetchMock: ReturnType<typeof createTmdbFetch>;

  beforeEach(() => {
    env.TMDB_READ_TOKEN = "test-read-token";
    fetchMock = createTmdbFetch({
      "/discover/movie": discoverRoute,
      "/search/keyword": fixture("search-keyword.json"),
      "/movie/493922": details,
      "/search/movie": fixture("search-movie.json"),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    env.TMDB_READ_TOKEN = undefined;
    env.TMDB_API_KEY = undefined;
    vi.unstubAllGlobals();
  });

  it("imports horror titles idempotently (upsert by tmdbId), tagging sub-collections", async () => {
    const first = await runTmdbSync({ mode: "daily" });
    expect(first).toMatchObject({ configured: true, done: true, cursor: 0 });
    expect(first.stepsRun).toBe(buildPlan("daily").length);
    // 3 horror titles in the fixture; the romcom and the untitled item are skipped.
    expect(await Movie.countDocuments({ source: "tmdb" })).toBe(3);
    const hereditary = await Movie.findOne({ tmdbId: 493922 }).lean();
    expect(hereditary).toMatchObject({ id: "tmdb-493922", title: "Hereditary", isHorror: true });
    expect(hereditary!.subgenres).toEqual(expect.arrayContaining(["supernatural", "psychological", "slasher", "zombie", "haunted-house"]));
    // Keyword search resolves the exact name match ("zombie" -> 12377), not the first hit.
    const zombieCall = fetchMock.mock.calls.map((c) => new URL(String(c[0]))).find((u) => u.searchParams.get("with_keywords") === "12377");
    expect(zombieCall).toBeDefined();
    // Bearer auth, never api_key.
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).includes("api_key"))).toBe(true);

    const before = await Movie.find({ source: "tmdb" }).sort({ id: 1 }).lean();
    const second = await runTmdbSync({ mode: "daily" });
    expect(second.done).toBe(true);
    const after = await Movie.find({ source: "tmdb" }).sort({ id: 1 }).lean();
    expect(after).toHaveLength(3);
    expect(after.map((m) => [m.id, [...(m.subgenres ?? [])].sort()])).toEqual(before.map((m) => [m.id, [...(m.subgenres ?? [])].sort()]));
    expect((await SyncState.findOne({ key: "tmdb-sync:daily" }).lean())?.lastSuccessAt).toBeTruthy();
  });

  it("is resumable: a small budget saves the cursor and the next run continues", async () => {
    const r1 = await runTmdbSync({ mode: "full", maxSteps: 3 });
    expect(r1).toMatchObject({ done: false, cursor: 3, stepsRun: 3 });
    const r2 = await runTmdbSync({ mode: "full", maxSteps: 2 });
    expect(r2.cursor).toBe(5);
    const r3 = await runTmdbSync({ mode: "full", reset: true, maxSteps: 1 });
    expect(r3.cursor).toBe(1);
  });

  it("stops on an upstream error and resumes from the failed page", async () => {
    let fail = true;
    vi.stubGlobal(
      "fetch",
      createTmdbFetch({ "/discover/movie": (url: URL) => (fail && url.searchParams.get("page") === "2" ? jsonResponse({}, 401) : discoverRoute(url)) }),
    );
    const r1 = await runTmdbSync({ mode: "full", maxSteps: 10 });
    expect(r1).toMatchObject({ done: false, cursor: 1 });
    expect(r1.error).toMatch(/401/);
    expect((await SyncState.findOne({ key: "tmdb-sync:full" }).lean())?.lastError).toMatch(/401/);
    fail = false;
    const r2 = await runTmdbSync({ mode: "full", maxSteps: 1 });
    expect(r2).toMatchObject({ cursor: 2, stepsRun: 1 });
    expect(r2.error).toBeUndefined();
  });

  it("never overwrites curated titles that share an id", async () => {
    await Movie.create({ id: "tmdb-948", title: "Curated Halloween", year: 1978, source: "admin" });
    const items = discover.results.map((r: unknown) => mapTmdbListItem(r)).filter(Boolean).map((fields: never) => ({ fields, tags: [] }));
    await upsertTmdbMovies(items);
    expect((await Movie.findOne({ id: "tmdb-948" }).lean())?.title).toBe("Curated Halloween");
    expect(await Movie.exists({ id: "tmdb-493922" })).not.toBeNull();
  });

  it("serves TMDB rows once titles are imported, hiding bundled titles", async () => {
    await seedCatalog();
    await runTmdbSync({ mode: "daily" });
    const res = await api().get("/api/movies");
    expect(res.status).toBe(200);
    const keys = res.body.map((c: { key: string }) => c.key);
    expect(keys).toEqual(expect.arrayContaining(["trending", "top-rated", "supernatural", "slasher", "classic"]));
    const ids = res.body.flatMap((c: { movies: Array<{ id: string }> }) => c.movies.map((m) => m.id));
    expect(ids.every((id: string) => id.startsWith("tmdb-"))).toBe(true);
    const classic = res.body.find((c: { key: string }) => c.key === "classic");
    expect(classic.movies.map((m: { id: string }) => m.id)).toEqual(["tmdb-948"]);
    // List payloads stay light.
    expect(res.body[0].movies[0]).not.toHaveProperty("providers");
    expect(res.body[0].movies.find((m: { id: string }) => m.id === "tmdb-493922")).toHaveProperty("backdrop");
  });

  it("fetches details lazily on first view, caches them, and keeps watchlists working", async () => {
    await runTmdbSync({ mode: "daily" });
    fetchMock.mockClear();
    const res = await api().get("/api/movies/tmdb-493922");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: "tmdb-493922",
      tagline: "Every family tree hides a secret.",
      runtime: 127,
      duration: "2h 07m",
      trailerKey: "V6wWKNij_1M",
      directors: ["Ari Aster"],
      certification: "A",
      imdbId: "tt7784604",
    });
    expect(res.body.castDetails[0].name).toBe("Toni Collette");
    expect(res.body.providers.region).toBe("IN");
    expect(calledPaths(fetchMock)).toEqual(["/movie/493922"]);
    const appended = new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("append_to_response");
    expect(appended).toContain("watch/providers");

    fetchMock.mockClear();
    await api().get("/api/movies/tmdb-493922");
    expect(fetchMock).not.toHaveBeenCalled(); // cached

    const u = await registerUser();
    const add = await api().post("/api/watchlist").set(auth(u.token)).send({ movie_id: "tmdb-493922" });
    expect(add.body.inWatchlist).toBe(true);
    const list = await api().get("/api/watchlist").set(auth(u.token));
    expect(list.body[0].movie.title).toBe("Hereditary");
  });

  it("serves the cached copy when TMDB fails during a detail refresh", async () => {
    await runTmdbSync({ mode: "daily" });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));
    const res = await api().get("/api/movies/tmdb-948");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Halloween");
  }, 30_000);

  it("deep-links an unknown tmdb-* id by fetching and storing it", async () => {
    env.EXTERNAL_CATALOG_ENABLED = true;
    vi.stubGlobal("fetch", createTmdbFetch({ "/movie/493922": details }));
    const res = await api().get("/api/movies/tmdb-493922");
    expect(res.status).toBe(200);
    expect(await Movie.exists({ tmdbId: 493922 })).not.toBeNull();
    expect((await api().get("/api/movies/tmdb-404404")).status).toBe(404);
    env.EXTERNAL_CATALOG_ENABLED = false;
  });

  it("search falls back to TMDB (horror only) and caches the query", async () => {
    const res = await api().get("/api/movies/search").query({ q: "scream" });
    expect(res.status).toBe(200);
    expect(res.body.items.map((m: { id: string }) => m.id)).toEqual(["tmdb-4232"]);
    expect(await Movie.exists({ tmdbId: 77777 })).toBeNull();
    fetchMock.mockClear();
    await api().get("/api/movies/search").query({ q: "Scream" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("browse filters by sub-genre, decade, rating and sorts", async () => {
    await runTmdbSync({ mode: "daily" });
    const byDecade = await api().get("/api/movies/browse").query({ decade: 1970 });
    expect(byDecade.body).toMatchObject({ total: 1, source: "tmdb" });
    expect(byDecade.body.items[0].id).toBe("tmdb-948");
    const top = await api().get("/api/movies/browse").query({ sort: "rating", limit: 2 });
    expect(top.body.items.map((m: { id: string }) => m.id)).toEqual(["tmdb-948", "tmdb-138843"]);
    expect(top.body).toMatchObject({ total: 3, totalPages: 2, page: 1, limit: 2 });
    const classic = await api().get("/api/movies/browse").query({ subgenre: "classic" });
    expect(classic.body.items.map((m: { id: string }) => m.id)).toEqual(["tmdb-948"]);
    const meta = await api().get("/api/movies/meta");
    expect(meta.body).toMatchObject({ source: "tmdb", tmdbConfigured: true });
  });

  it("import script: parses args and runs the full plan to completion", async () => {
    expect(parseImportArgs(["--mode=daily", "--reset", "--max-pages=5"])).toEqual({ mode: "daily", reset: true, maxPages: 5, dnsOverride: true });
    expect(() => parseImportArgs(["--mode=weekly"])).toThrow();
    expect(() => parseImportArgs(["--bogus"])).toThrow();
    const logs: string[] = [];
    const limited = await runImport({ mode: "full", reset: true, maxPages: 12, dnsOverride: false }, (m) => logs.push(m));
    expect(limited).toMatchObject({ done: false, cursor: 12 });
    const result = await runImport({ mode: "full", reset: false, dnsOverride: false }, (m) => logs.push(m));
    expect(result.done).toBe(true);
    expect(logs.at(-1)).toMatch(/complete/);
    expect(await Movie.countDocuments({ source: "tmdb" })).toBe(3);
  });

  it("uses the v3 api_key when only TMDB_API_KEY is set", async () => {
    env.TMDB_READ_TOKEN = undefined;
    env.TMDB_API_KEY = "v3-key";
    await runTmdbSync({ mode: "daily", maxSteps: 1 });
    expect(String(fetchMock.mock.calls[0][0])).toContain("api_key=v3-key");
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers).not.toHaveProperty("Authorization");
  });

  it("existing watchlist entries for bundled titles keep resolving in TMDB mode", async () => {
    await seedCatalog();
    const u = await registerUser();
    await WatchlistEntry.create({ userId: u.user.id, movieId: "3" });
    await runTmdbSync({ mode: "daily" });
    const list = await api().get("/api/watchlist").set(auth(u.token));
    expect(list.body[0].movie).toMatchObject({ id: "3", title: "The Whisper" });
    expect((await api().get("/api/movies/3")).status).toBe(200);
  });
});

describe("TMDB not configured (fallback)", () => {
  const fetchMock = vi.fn(async () => jsonResponse({}, 500));

  beforeEach(() => {
    env.TMDB_READ_TOKEN = undefined;
    env.TMDB_API_KEY = undefined;
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sync is a no-op that never calls TMDB", async () => {
    const r = await runTmdbSync({ mode: "full" });
    expect(r).toMatchObject({ configured: false, stepsRun: 0, done: false });
    expect(r.message).toMatch(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rows, search, detail and browse keep working from the bundled catalog", async () => {
    await seedCatalog();
    const rows = await api().get("/api/movies");
    expect(rows.body[0]).toMatchObject({ key: "trending", title: "Trending Horror" });
    expect((await api().get("/api/movies/search").query({ q: "zzz-nothing" })).body.total).toBe(0);
    expect((await api().get("/api/movies/tmdb-493922")).status).toBe(404);
    const zombie = await api().get("/api/movies/browse").query({ subgenre: "zombie" });
    expect(zombie.body.items.map((m: { id: string }) => m.id)).toEqual(["4"]);
    expect(zombie.body.source).toBe("fallback");
    const newest = await api().get("/api/movies/browse").query({ sort: "newest", minRating: 8.6 });
    expect(newest.body.items.map((m: { id: string }) => m.id)).toEqual(["3", "5"]);
    const decade = await api().get("/api/movies/browse").query({ decade: 2020, sort: "title", page: 2, limit: 5 });
    expect(decade.body).toMatchObject({ total: 8, page: 2, totalPages: 2 });
    expect(fetchMock).not.toHaveBeenCalled();
    const meta = await api().get("/api/movies/meta");
    expect(meta.body).toMatchObject({ source: "fallback", tmdbConfigured: false });
    expect(meta.body.subgenres.map((s: { key: string }) => s.key)).toContain("slasher");
  });

  it("browse validates its query", async () => {
    expect((await api().get("/api/movies/browse").query({ subgenre: "romcom" })).status).toBe(400);
    expect((await api().get("/api/movies/browse").query({ decade: 1985 })).status).toBe(400);
    expect((await api().get("/api/movies/browse").query({ sort: "random" })).status).toBe(400);
    expect((await api().get("/api/movies/browse").query({ decade: "", minRating: "" })).status).toBe(200);
  });

  it("health reports TMDB as not configured", async () => {
    const res = await api().get("/api/health");
    expect(res.body).toMatchObject({ tmdb: "not configured", catalog: "bundled+tvmaze" });
  });
});
