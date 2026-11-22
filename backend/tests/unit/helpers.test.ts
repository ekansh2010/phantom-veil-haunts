import { describe, expect, it } from "vitest";
import { backupTrailerFor } from "../../src/data/catalog";
import { toPublicMovie, toPublicUser } from "../../src/services/serializers";
import { HttpError } from "../../src/utils/httpError";
import { escapeRegex, generateId, generateToken, hashToken, paginate } from "../../src/utils/helpers";

describe("helpers", () => {
  it("escapeRegex makes metacharacters literal", () => {
    const input = "a.b*c+(d)?[e]{f}|g^h$i\\j";
    expect(new RegExp(escapeRegex(input)).test(input)).toBe(true);
    expect(new RegExp(`^${escapeRegex(".*")}$`).test("anything")).toBe(false);
  });

  it("generateId is prefixed and unique", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("u")));
    expect(ids.size).toBe(100);
    expect([...ids][0]).toMatch(/^u_[a-f0-9]{24}$/);
  });

  it("generateToken is 64 hex chars and hashToken is deterministic and different", () => {
    const t = generateToken();
    expect(t).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
  });

  it("paginate computes skip", () => {
    expect(paginate(1, 20)).toEqual({ skip: 0, limit: 20 });
    expect(paginate(3, 10)).toEqual({ skip: 20, limit: 10 });
  });

  it("HttpError factories carry statuses", () => {
    expect(HttpError.badRequest("x").status).toBe(400);
    expect(HttpError.unauthorized().status).toBe(401);
    expect(HttpError.forbidden().status).toBe(403);
    expect(HttpError.notFound().status).toBe(404);
    expect(HttpError.conflict("x").status).toBe(409);
    expect(HttpError.unavailable().status).toBe(503);
  });

  it("backupTrailerFor picks a clip by genre", () => {
    expect(backupTrailerFor("Zombie Apocalypse")).toMatch(/painted-face/);
    expect(backupTrailerFor("Haunted House")).toMatch(/cabin/);
    expect(backupTrailerFor()).toMatch(/lightnings/);
  });
});

describe("serializers", () => {
  it("toPublicUser exposes only safe fields", () => {
    const u = toPublicUser({ id: "u1", email: "a@b.co", username: "A", role: "user", favoriteGenre: "Horror", avatarUrl: "", createdAt: new Date("2026-01-01T00:00:00Z") });
    expect(u).toEqual({ id: "u1", email: "a@b.co", username: "A", role: "user", favorite_genre: "Horror", avatar_url: "", created_at: "2026-01-01T00:00:00.000Z" });
  });

  it("toPublicMovie hides internal fields and omits empty optionals", () => {
    const m = toPublicMovie({
      id: "1", title: "T", poster: "/p.jpg", rating: 8, duration: "1h", year: 2024, description: "d", genre: "g", cast: [],
      mediaType: "movie", source: "seed", popularity: 50, createdAt: new Date(), updatedAt: new Date(),
    });
    expect(m).not.toHaveProperty("source");
    expect(m).not.toHaveProperty("popularity");
    expect(m).not.toHaveProperty("trailer");
    expect(m).not.toHaveProperty("imdbId");
  });
});
