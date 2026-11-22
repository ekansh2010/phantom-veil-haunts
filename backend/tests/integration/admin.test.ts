import { describe, expect, it } from "vitest";
import { User, WatchlistEntry } from "../../src/models";
import { api, auth, registerAdmin, registerUser, seedCatalog } from "../helpers";

describe("admin endpoints", () => {
  it("401 anonymous, 403 for regular users on every admin route", async () => {
    const u = await registerUser();
    for (const [method, url] of [
      ["get", "/api/admin/stats"],
      ["get", "/api/admin/users"],
      ["patch", "/api/admin/users/x/role"],
      ["delete", "/api/admin/users/x"],
    ] as const) {
      expect((await api()[method](url)).status).toBe(401);
      const res = await api()[method](url).set(auth(u.token)).send({ role: "admin" });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: "Admin access required" });
    }
  });

  it("role comes from the database, not the token: demotion takes effect immediately", async () => {
    const admin = await registerAdmin();
    expect((await api().get("/api/admin/stats").set(auth(admin.token))).status).toBe(200);
    await User.updateOne({ id: admin.user.id }, { role: "user" });
    expect((await api().get("/api/admin/stats").set(auth(admin.token))).status).toBe(403);
  });

  it("GET /stats returns counts and the most-watchlisted titles", async () => {
    await seedCatalog();
    const admin = await registerAdmin();
    const a = await registerUser();
    const b = await registerUser();
    await api().put("/api/watchlist/3").set(auth(a.token));
    await api().put("/api/watchlist/3").set(auth(b.token));
    await api().put("/api/watchlist/1").set(auth(a.token));

    const res = await api().get("/api/admin/stats").set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ users: 3, admins: 1, movies: 8, watchlistEntries: 3 });
    expect(res.body.mostWatchlisted[0]).toMatchObject({ movie_id: "3", count: 2, movie: { title: "The Whisper" } });
    expect(res.body.mostWatchlisted[1]).toMatchObject({ movie_id: "1", count: 1 });
  });

  it("GET /users paginates and searches (regex-safe)", async () => {
    const admin = await registerAdmin();
    await registerUser({ username: "Specter", email: "specter@veil.test" });
    await registerUser({ username: "Shade", email: "shade@veil.test" });

    const all = await api().get("/api/admin/users").query({ limit: 2 }).set(auth(admin.token));
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(all.body.items).toHaveLength(2);
    expect(all.body.items[0].passwordHash).toBeUndefined();

    const found = await api().get("/api/admin/users").query({ q: "spec" }).set(auth(admin.token));
    expect(found.body.items.map((u: { username: string }) => u.username)).toEqual(["Specter"]);

    const literal = await api().get("/api/admin/users").query({ q: ".*" }).set(auth(admin.token));
    expect(literal.body.total).toBe(0);
  });

  it("PATCH /users/:id/role promotes a user and revokes their sessions", async () => {
    const admin = await registerAdmin();
    const u = await registerUser();
    const res = await api().patch(`/api/admin/users/${u.user.id}/role`).set(auth(admin.token)).send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
    expect((await api().get("/api/auth/me").set(auth(u.token))).status).toBe(401);
    const relog = await api().post("/api/auth/login").send({ email: u.user.email, password: u.password });
    expect((await api().get("/api/admin/stats").set(auth(relog.body.token))).status).toBe(200);
  });

  it("PATCH role validates input, 404s unknown users, and blocks self-demotion", async () => {
    const admin = await registerAdmin();
    expect((await api().patch("/api/admin/users/x/role").set(auth(admin.token)).send({ role: "god" })).status).toBe(400);
    expect((await api().patch("/api/admin/users/missing/role").set(auth(admin.token)).send({ role: "user" })).status).toBe(404);
    const self = await api().patch(`/api/admin/users/${admin.user.id}/role`).set(auth(admin.token)).send({ role: "user" });
    expect(self.status).toBe(400);
    expect(self.body.error).toBe("You cannot remove your own admin role");
  });

  it("DELETE /users/:id removes the user and their watchlist", async () => {
    await seedCatalog();
    const admin = await registerAdmin();
    const u = await registerUser();
    await api().put("/api/watchlist/1").set(auth(u.token));
    expect((await api().delete(`/api/admin/users/${u.user.id}`).set(auth(admin.token))).status).toBe(204);
    expect(await User.exists({ id: u.user.id })).toBeNull();
    expect(await WatchlistEntry.countDocuments({ userId: u.user.id })).toBe(0);
    expect((await api().get("/api/auth/me").set(auth(u.token))).status).toBe(401);
  });

  it("DELETE /users/:id 404s unknown users and blocks self-deletion", async () => {
    const admin = await registerAdmin();
    expect((await api().delete("/api/admin/users/missing").set(auth(admin.token))).status).toBe(404);
    expect((await api().delete(`/api/admin/users/${admin.user.id}`).set(auth(admin.token))).status).toBe(400);
  });
});
