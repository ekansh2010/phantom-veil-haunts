import { describe, expect, it } from "vitest";
import {
  createMovieSchema,
  passwordRule,
  registerSchema,
  safeUrl,
  searchMoviesQuery,
  toggleWatchlistSchema,
  updateProfileSchema,
} from "../../src/validation/schemas";

describe("validation schemas", () => {
  it("passwordRule enforces length, a letter and a digit", () => {
    expect(passwordRule.safeParse("Spooky123").success).toBe(true);
    expect(passwordRule.safeParse("short1").success).toBe(false);
    expect(passwordRule.safeParse("12345678").success).toBe(false);
    expect(passwordRule.safeParse("abcdefgh").success).toBe(false);
    expect(passwordRule.safeParse("a1".repeat(65)).success).toBe(false);
  });

  it("registerSchema normalises email, strips unknown keys and treats blank username as absent", () => {
    const r = registerSchema.parse({ email: "  MiXeD@Veil.Test ", password: "Spooky123", username: "  ", role: "admin" });
    expect(r).toEqual({ email: "mixed@veil.test", password: "Spooky123", username: undefined });
  });

  it("safeUrl accepts http(s) and site paths, rejects dangerous schemes", () => {
    for (const ok of ["", "https://a.b/c.jpg", "http://x.y", "/posters/poster1.jpg"]) expect(safeUrl.safeParse(ok).success).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "//evil.com/x", "ftp://x"]) expect(safeUrl.safeParse(bad).success).toBe(false);
  });

  it("toggleWatchlistSchema rejects objects and odd characters (NoSQL injection)", () => {
    expect(toggleWatchlistSchema.safeParse({ movie_id: "tv-12" }).success).toBe(true);
    expect(toggleWatchlistSchema.safeParse({ movie_id: { $gt: "" } }).success).toBe(false);
    expect(toggleWatchlistSchema.safeParse({ movie_id: "../etc" }).success).toBe(false);
  });

  it("updateProfileSchema requires at least one field", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.safeParse({ favorite_genre: "" }).success).toBe(true);
  });

  it("searchMoviesQuery coerces and bounds pagination", () => {
    expect(searchMoviesQuery.parse({ page: "2", limit: "5" })).toEqual({ q: "", genre: "", page: 2, limit: 5 });
    expect(searchMoviesQuery.safeParse({ limit: "51" }).success).toBe(false);
  });

  it("createMovieSchema applies defaults and validates imdbId", () => {
    const m = createMovieSchema.parse({ title: "X", year: "2020" });
    expect(m).toMatchObject({ title: "X", year: 2020, rating: 0, genre: "Horror", cast: [], mediaType: "movie" });
    expect(createMovieSchema.safeParse({ title: "X", year: 2020, imdbId: "123" }).success).toBe(false);
  });
});
