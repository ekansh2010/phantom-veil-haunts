import { beforeEach, describe, expect, it } from "vitest";
import { Movie, WatchlistEntry } from "../../src/models";
import { api, auth, registerAdmin, registerUser, seedCatalog } from "../helpers";

describe("public movie endpoints", () => {
  beforeEach(async () => {
    await seedCatalog();
  });

  it("GET /api/movies returns categorised rows in the frontend Movie shape", async () => {
    const res = await api().get("/api/movies");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toMatch(/max-age/);
    const titles = res.body.map((c: { title: string }) => c.title);
    expect(titles).toEqual(["Trending Horror", "New Nightmares", "Supernatural Horror", "Psychological Horror", "Classic Horror", "Zombie Apocalypse", "Haunted House"]);

    const trending = res.body[0].movies;
    expect(trending[0]).toMatchObject({ id: "3", title: "The Whisper" }); // highest popularity
    expect(trending[0]).not.toHaveProperty("source");
    expect(trending[0]).not.toHaveProperty("_id");
    expect(Object.keys(trending[0])).toEqual(expect.arrayContaining(["id", "title", "poster", "rating", "duration", "year", "description", "genre", "cast", "mediaType"]));

    const newest = res.body[1].movies;
    expect(newest[0].year).toBe(2025);
    const zombie = res.body.find((c: { title: string }) => c.title === "Zombie Apocalypse");
    expect(zombie.movies.map((m: { id: string }) => m.id)).toEqual(["4"]);
  });

  it("GET /api/movies omits empty rows and returns [] for an empty catalog", async () => {
    await Movie.deleteMany({});
    const res = await api().get("/api/movies");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /api/movies/:id returns one title", async () => {
    const res = await api().get("/api/movies/5");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "5", title: "Porcelain", genre: "Psychological Horror" });
  });

  it("GET /api/movies/:id 404s for unknown ids", async () => {
    const res = await api().get("/api/movies/tv-999");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Movie not found" });
  });

  it("GET /api/movies/:id validates the id format", async () => {
    const res = await api().get("/api/movies/bad$id");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("movie_id contains invalid characters");
  });

  it("GET /api/movies/:id/similar returns same-genre titles first, never itself", async () => {
    const res = await api().get("/api/movies/1/similar");
    expect(res.status).toBe(200);
    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).not.toContain("1");
    // Same-genre titles by rating first, then topped up with the best of the rest.
    expect(ids.slice(0, 3)).toEqual(["3", "8", "7"]);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
  });

  it("GET /api/movies/:id/similar 404s for unknown ids", async () => {
    expect((await api().get("/api/movies/nope/similar")).status).toBe(404);
  });

  it("GET /api/movies/search finds by title, cast or genre (case-insensitive) with pagination", async () => {
    const byTitle = await api().get("/api/movies/search").query({ q: "whisper" });
    expect(byTitle.status).toBe(200);
    expect(byTitle.body).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
    expect(byTitle.body.items[0].id).toBe("3");

    const byCast = await api().get("/api/movies/search").query({ q: "nadia" });
    expect(byCast.body.items.map((m: { id: string }) => m.id)).toEqual(["6"]);

    const byGenre = await api().get("/api/movies/search").query({ genre: "supernatural", limit: 2, page: 2 });
    expect(byGenre.body).toMatchObject({ total: 4, page: 2, limit: 2, totalPages: 2 });
    expect(byGenre.body.items).toHaveLength(2);
  });

  it("GET /api/movies/search treats regex metacharacters literally", async () => {
    const res = await api().get("/api/movies/search").query({ q: ".*" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    const evil = await api().get("/api/movies/search").query({ q: "(a+)+$" });
    expect(evil.status).toBe(200);
  });

  it("GET /api/movies/search validates pagination", async () => {
    expect((await api().get("/api/movies/search").query({ limit: 500 })).status).toBe(400);
    expect((await api().get("/api/movies/search").query({ page: 0 })).status).toBe(400);
  });
});

describe("admin catalog management", () => {
  const newMovie = { title: "The Hollow Bell", year: 2026, genre: "Classic Horror", rating: 7.2, cast: ["Ada Grey"], poster: "https://img.example.com/bell.jpg" };

  it("admin can create, update and delete a movie", async () => {
    const admin = await registerAdmin();
    const created = await api().post("/api/movies").set(auth(admin.token)).send(newMovie);
    expect(created.status).toBe(201);
    expect(created.body.id).toMatch(/^pv_[a-f0-9]{24}$/);
    expect(created.body.trailer).toMatch(/^https:\/\//);

    const updated = await api().patch(`/api/movies/${created.body.id}`).set(auth(admin.token)).send({ rating: 9.4 });
    expect(updated.status).toBe(200);
    expect(updated.body.rating).toBe(9.4);

    const del = await api().delete(`/api/movies/${created.body.id}`).set(auth(admin.token));
    expect(del.status).toBe(204);
    expect((await api().get(`/api/movies/${created.body.id}`)).status).toBe(404);
  });

  it("deleting a movie also removes it from watchlists", async () => {
    await seedCatalog();
    const admin = await registerAdmin();
    const user = await registerUser();
    await api().post("/api/watchlist").set(auth(user.token)).send({ movie_id: "2" });
    await api().delete("/api/movies/2").set(auth(admin.token)).expect(204);
    expect(await WatchlistEntry.countDocuments({ movieId: "2" })).toBe(0);
  });

  it("403 for non-admins and 401 for anonymous users", async () => {
    const user = await registerUser();
    const forbidden = await api().post("/api/movies").set(auth(user.token)).send(newMovie);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: "Admin access required" });
    expect((await api().post("/api/movies").send(newMovie)).status).toBe(401);
    expect((await api().delete("/api/movies/1").set(auth(user.token))).status).toBe(403);
  });

  it("validates movie input", async () => {
    const admin = await registerAdmin();
    const noTitle = await api().post("/api/movies").set(auth(admin.token)).send({ year: 2020 });
    expect(noTitle.status).toBe(400);
    const badPoster = await api().post("/api/movies").set(auth(admin.token)).send({ ...newMovie, poster: "javascript:alert(1)" });
    expect(badPoster.status).toBe(400);
    expect(badPoster.body.error).toMatch(/http\(s\) URL/);
    const badRating = await api().post("/api/movies").set(auth(admin.token)).send({ ...newMovie, rating: 11 });
    expect(badRating.status).toBe(400);
    const emptyPatch = await api().patch("/api/movies/1").set(auth(admin.token)).send({});
    expect(emptyPatch.status).toBe(400);
  });

  it("404 when updating or deleting a missing movie", async () => {
    const admin = await registerAdmin();
    expect((await api().patch("/api/movies/missing").set(auth(admin.token)).send({ rating: 5 })).status).toBe(404);
    expect((await api().delete("/api/movies/missing").set(auth(admin.token))).status).toBe(404);
  });
});
