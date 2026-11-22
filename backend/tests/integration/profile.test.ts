import { describe, expect, it } from "vitest";
import { api, auth, registerUser } from "../helpers";

describe("profile", () => {
  it("requires authentication", async () => {
    expect((await api().get("/api/profile")).status).toBe(401);
    expect((await api().put("/api/profile").send({ username: "x" })).status).toBe(401);
  });

  it("GET returns the profile", async () => {
    const u = await registerUser({ username: "Banshee" });
    const res = await api().get("/api/profile").set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: u.user.id, username: "Banshee", favorite_genre: "", avatar_url: "", role: "user" });
  });

  it("PUT updates username, favorite genre and avatar", async () => {
    const u = await registerUser();
    const res = await api()
      .put("/api/profile")
      .set(auth(u.token))
      .send({ username: "Poltergeist", favorite_genre: "Haunted House", avatar_url: "https://img.example.com/a.png" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: "Poltergeist", favorite_genre: "Haunted House", avatar_url: "https://img.example.com/a.png" });
    expect((await api().get("/api/profile").set(auth(u.token))).body.username).toBe("Poltergeist");
  });

  it("allows clearing the favorite genre with an empty string", async () => {
    const u = await registerUser();
    await api().put("/api/profile").set(auth(u.token)).send({ favorite_genre: "Classic Horror" });
    const res = await api().patch("/api/profile").set(auth(u.token)).send({ favorite_genre: "" });
    expect(res.status).toBe(200);
    expect(res.body.favorite_genre).toBe("");
  });

  it("allows keeping your own username", async () => {
    const u = await registerUser({ username: "Selfsame" });
    const res = await api().put("/api/profile").set(auth(u.token)).send({ username: "selfsame" });
    expect(res.status).toBe(200);
  });

  it("409 when the username belongs to someone else", async () => {
    await registerUser({ username: "Taken" });
    const u = await registerUser();
    const res = await api().put("/api/profile").set(auth(u.token)).send({ username: "TAKEN" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Username is already taken");
  });

  it("validates input and ignores unknown fields like role", async () => {
    const u = await registerUser();
    expect((await api().put("/api/profile").set(auth(u.token)).send({})).status).toBe(400);
    expect((await api().put("/api/profile").set(auth(u.token)).send({ username: "a" })).status).toBe(400);
    expect((await api().put("/api/profile").set(auth(u.token)).send({ avatar_url: "javascript:alert(1)" })).status).toBe(400);
    const sneaky = await api().put("/api/profile").set(auth(u.token)).send({ role: "admin", favorite_genre: "Zombie Apocalypse" });
    expect(sneaky.status).toBe(200);
    expect(sneaky.body.role).toBe("user");
  });
});
