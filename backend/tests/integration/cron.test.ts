import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env";
import { Movie } from "../../src/models";
import { api, auth, registerAdmin, registerUser } from "../helpers";
import { createTmdbFetch, fixture, jsonResponse } from "../tmdbMock";

const SECRET = "cron-secret-for-tests-0123456789";

describe("cron + admin TMDB sync endpoints", () => {
  beforeEach(() => {
    env.CRON_SECRET = SECRET;
    vi.stubGlobal(
      "fetch",
      createTmdbFetch({
        "/discover/movie": (url: URL) => jsonResponse(url.searchParams.get("page") === "1" ? fixture("discover-page1.json") : { results: [] }),
        "/search/keyword": fixture("search-keyword.json"),
      }),
    );
  });

  afterEach(() => {
    env.CRON_SECRET = undefined;
    env.TMDB_READ_TOKEN = undefined;
    vi.unstubAllGlobals();
  });

  it("GET /api/cron/sync rejects missing or wrong secrets with 401", async () => {
    expect((await api().get("/api/cron/sync")).status).toBe(401);
    expect((await api().get("/api/cron/sync").set("Authorization", "Bearer wrong")).status).toBe(401);
    expect((await api().get("/api/cron/sync").set("Authorization", SECRET)).status).toBe(401);
  });

  it("rejects everything when CRON_SECRET is not configured", async () => {
    env.CRON_SECRET = undefined;
    expect((await api().get("/api/cron/sync").set("Authorization", "Bearer ")).status).toBe(401);
    expect((await api().get("/api/cron/sync").set("Authorization", "Bearer undefined")).status).toBe(401);
  });

  it("is a 200 no-op without a TMDB key", async () => {
    const res = await api().get("/api/cron/sync").set("Authorization", `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, skipped: true });
    expect(res.body.message).toMatch(/not configured/);
  });

  it("runs the daily refresh, then continues the full import", async () => {
    env.TMDB_READ_TOKEN = "tok";
    const res = await api().get("/api/cron/sync").set("Authorization", `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(false);
    expect(res.body.daily).toMatchObject({ configured: true, done: true });
    expect(res.body.full).toMatchObject({ configured: true, done: true });
    expect(await Movie.countDocuments({ source: "tmdb" })).toBe(3);
  });

  it("POST /api/admin/sync/tmdb is admin-only and a no-op without a key", async () => {
    expect((await api().post("/api/admin/sync/tmdb").send({})).status).toBe(401);
    const user = await registerUser();
    expect((await api().post("/api/admin/sync/tmdb").set(auth(user.token)).send({})).status).toBe(403);
    const admin = await registerAdmin();
    const res = await api().post("/api/admin/sync/tmdb").set(auth(admin.token)).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ configured: false, mode: "daily" });
    expect((await api().post("/api/admin/sync/tmdb").set(auth(admin.token)).send({ mode: "weekly" })).status).toBe(400);
  });

  it("admin sync imports when configured, and stats report the catalog source", async () => {
    env.TMDB_READ_TOKEN = "tok";
    const admin = await registerAdmin();
    const res = await api().post("/api/admin/sync/tmdb").set(auth(admin.token)).send({ mode: "full", reset: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ configured: true, mode: "full", done: true });
    const stats = await api().get("/api/admin/stats").set(auth(admin.token));
    expect(stats.body.catalog).toMatchObject({ source: "tmdb", moviesBySource: { tmdb: 3 } });
    expect(stats.body.catalog.tmdb).toMatchObject({ configured: true, status: "configured", tmdbMovies: 3 });
    expect(stats.body.catalog.tmdb.full.lastSuccessAt).toBeTruthy();
  });

  it("admin stats say TMDB is not configured without a key", async () => {
    const admin = await registerAdmin();
    const stats = await api().get("/api/admin/stats").set(auth(admin.token));
    expect(stats.body.catalog).toMatchObject({ source: "fallback", tmdb: { configured: false, status: "not configured" } });
  });
});
