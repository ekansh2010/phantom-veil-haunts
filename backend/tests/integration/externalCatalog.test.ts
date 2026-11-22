import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env";
import { Movie, SyncState } from "../../src/models";
import { syncExternalCatalog } from "../../src/services/externalCatalog.service";
import { api, auth, registerUser, seedCatalog } from "../helpers";

const show = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  genres: ["Horror", "Supernatural"],
  rating: { average: 8.1 },
  runtime: 50,
  premiered: "2019-10-01",
  summary: "<p>Something <b>lurks</b>.</p>",
  image: { medium: `https://static.tvmaze.com/${id}.jpg` },
  weight: 99,
  externals: { imdb: "tt1234567" },
  ...extra,
});

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe("external catalog (TVmaze) integration", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    env.EXTERNAL_CATALOG_ENABLED = true;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    env.EXTERNAL_CATALOG_ENABLED = false;
    vi.unstubAllGlobals();
  });

  it("syncs titles into MongoDB with one bulk upsert and shows them in categories", async () => {
    await seedCatalog();
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("q=horror") ? jsonResponse([{ show: show(101, "Midnight Mass") }, { show: show(102, "Hill House") }]) : jsonResponse([]),
    );

    const res = await api().get("/api/movies");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const trending = res.body[0].movies.map((m: { id: string }) => m.id);
    expect(trending.slice(0, 2)).toEqual(["tv-101", "tv-102"]); // weight 99 beats the seed popularity
    const stored = await Movie.findOne({ id: "tv-101" }).lean();
    expect(stored).toMatchObject({ source: "tvmaze", mediaType: "tv", description: "Something lurks.", duration: "50m", year: 2019 });
    expect(await Movie.countDocuments()).toBe(10);
  });

  it("caches the sync in the database (no refetch within the TTL)", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ show: show(7, "Ghosts") }]));
    await syncExternalCatalog();
    await syncExternalCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const state = await SyncState.findOne({ key: "external-catalog" }).lean();
    expect(state?.itemCount).toBe(1);
  });

  it("refetches after the TTL expires", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ show: show(7, "Ghosts") }]));
    await syncExternalCatalog(new Date("2026-01-01T00:00:00Z"));
    await syncExternalCatalog(new Date("2026-01-03T00:00:00Z"));
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("serves the stored catalog when the upstream API fails, and backs off", async () => {
    await seedCatalog();
    fetchMock.mockRejectedValue(new Error("network down"));
    const res = await api().get("/api/movies");
    expect(res.status).toBe(200);
    expect(res.body[0].movies.length).toBe(8);
    await syncExternalCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(5); // no retry inside the back-off window
  });

  it("never overwrites curated titles that share an id", async () => {
    await Movie.create({ id: "tv-5", title: "Curated", year: 2020, source: "admin" });
    fetchMock.mockImplementation(async (url: string) => (url.includes("q=horror") ? jsonResponse([{ show: show(5, "Upstream") }, { show: show(6, "New") }]) : jsonResponse([])));
    await syncExternalCatalog();
    expect((await Movie.findOne({ id: "tv-5" }).lean())?.title).toBe("Curated");
    expect(await Movie.exists({ id: "tv-6" })).not.toBeNull();
  });

  it("fetches an unknown tv-* title on demand for deep links and watchlists", async () => {
    fetchMock.mockResolvedValue(jsonResponse(show(555, "The Haunting", { _embedded: { cast: [{ person: { name: "Kate Siegel" } }] } })));
    const res = await api().get("/api/movies/tv-555");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "tv-555", title: "The Haunting", cast: ["Kate Siegel"], imdbId: "tt1234567" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.tvmaze.com/shows/555?embed=cast");

    const u = await registerUser();
    fetchMock.mockResolvedValue(jsonResponse(show(556, "Another")));
    const add = await api().post("/api/watchlist").set(auth(u.token)).send({ movie_id: "tv-556" });
    expect(add.body.inWatchlist).toBe(true);
  });

  it("404s when the upstream title does not exist", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    expect((await api().get("/api/movies/tv-404")).status).toBe(404);
  });
});
