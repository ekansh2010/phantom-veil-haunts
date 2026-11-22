import { beforeEach, describe, expect, it } from "vitest";
import { WatchlistEntry } from "../../src/models";
import { api, auth, registerUser, seedCatalog } from "../helpers";

describe("watchlist", () => {
  beforeEach(async () => {
    await seedCatalog();
  });

  it("requires authentication", async () => {
    expect((await api().get("/api/watchlist")).status).toBe(401);
    expect((await api().post("/api/watchlist").send({ movie_id: "1" })).status).toBe(401);
    expect((await api().delete("/api/watchlist/1")).status).toBe(401);
  });

  it("starts empty", async () => {
    const u = await registerUser();
    const res = await api().get("/api/watchlist").set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST toggles a movie in and out, and GET returns movie details", async () => {
    const u = await registerUser();
    const add = await api().post("/api/watchlist").set(auth(u.token)).send({ movie_id: "3" });
    expect(add.status).toBe(200);
    expect(add.body).toEqual({ message: "Added to watchlist", inWatchlist: true });

    const list = await api().get("/api/watchlist").set(auth(u.token));
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ movie_id: "3", movie: { id: "3", title: "The Whisper" } });
    expect(typeof list.body[0].added_at).toBe("string");

    const remove = await api().post("/api/watchlist").set(auth(u.token)).send({ movie_id: "3" });
    expect(remove.body).toEqual({ message: "Removed from watchlist", inWatchlist: false });
    expect((await api().get("/api/watchlist").set(auth(u.token))).body).toEqual([]);
  });

  it("lists newest first", async () => {
    const u = await registerUser();
    await api().put("/api/watchlist/1").set(auth(u.token)).expect(201);
    await new Promise((r) => setTimeout(r, 5));
    await api().put("/api/watchlist/2").set(auth(u.token)).expect(201);
    const list = await api().get("/api/watchlist").set(auth(u.token));
    expect(list.body.map((w: { movie_id: string }) => w.movie_id)).toEqual(["2", "1"]);
  });

  it("PUT is idempotent (201 then 200, never duplicates)", async () => {
    const u = await registerUser();
    expect((await api().put("/api/watchlist/4").set(auth(u.token))).status).toBe(201);
    expect((await api().put("/api/watchlist/4").set(auth(u.token))).status).toBe(200);
    await Promise.all([1, 2, 3].map(() => api().put("/api/watchlist/5").set(auth(u.token))));
    expect(await WatchlistEntry.countDocuments({ userId: u.user.id })).toBe(2);
  });

  it("DELETE removes an entry and 404s when absent", async () => {
    const u = await registerUser();
    await api().put("/api/watchlist/6").set(auth(u.token));
    expect((await api().delete("/api/watchlist/6").set(auth(u.token))).status).toBe(204);
    const again = await api().delete("/api/watchlist/6").set(auth(u.token));
    expect(again.status).toBe(404);
    expect(again.body).toEqual({ error: "Movie is not in your watchlist" });
  });

  it("404s when adding a movie that does not exist", async () => {
    const u = await registerUser();
    const res = await api().post("/api/watchlist").set(auth(u.token)).send({ movie_id: "nope" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Movie not found" });
  });

  it("validates movie_id", async () => {
    const u = await registerUser();
    expect((await api().post("/api/watchlist").set(auth(u.token)).send({})).status).toBe(400);
    const injection = await api().post("/api/watchlist").set(auth(u.token)).send({ movie_id: { $ne: null } });
    expect(injection.status).toBe(400);
  });

  it("keeps each user's watchlist private", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await api().post("/api/watchlist").set(auth(a.token)).send({ movie_id: "1" });
    expect((await api().get("/api/watchlist").set(auth(b.token))).body).toEqual([]);
    // B removing "1" must not touch A's entry.
    expect((await api().delete("/api/watchlist/1").set(auth(b.token))).status).toBe(404);
    expect((await api().get("/api/watchlist").set(auth(a.token))).body).toHaveLength(1);
  });

  it("returns movie: null for entries whose movie was removed", async () => {
    const u = await registerUser();
    await WatchlistEntry.create({ userId: u.user.id, movieId: "ghost-title" });
    const list = await api().get("/api/watchlist").set(auth(u.token));
    expect(list.body).toEqual([expect.objectContaining({ movie_id: "ghost-title", movie: null })]);
  });
});
