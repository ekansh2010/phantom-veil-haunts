import { describe, expect, it } from "vitest";
import { backupTrailerFor, normalizeTrailerUrl, SEED_MOVIES } from "../../src/data/catalog";
import { toPublicMovie } from "../../src/services/serializers";
import type { IMovie } from "../../src/models/index";

const CURRENT = /^https:\/\/assets\.mixkit\.co\/videos\/(\d+)\/\1-720\.mp4$/;

describe("trailer URLs", () => {
  it("rewrites retired Mixkit preview URLs to the current clip URL", () => {
    expect(normalizeTrailerUrl("https://assets.mixkit.co/videos/preview/mixkit-foggy-dark-forest-in-black-and-white-41619-large.mp4")).toBe(
      "https://assets.mixkit.co/videos/41619/41619-720.mp4",
    );
  });

  it("leaves other URLs untouched", () => {
    for (const u of ["https://assets.mixkit.co/videos/41619/41619-720.mp4", "https://example.com/preview/mixkit-x-1-large.mp4", "/local.mp4"]) {
      expect(normalizeTrailerUrl(u)).toBe(u);
    }
  });

  it("bundled catalog and fallbacks only use current clip URLs", () => {
    for (const m of SEED_MOVIES) expect(m.trailer).toMatch(CURRENT);
    for (const g of ["zombie", "psychological", "haunted house", "ghost", ""]) expect(backupTrailerFor(g)).toMatch(CURRENT);
  });

  it("serializer fixes legacy URLs stored in the database", () => {
    const stored = { ...SEED_MOVIES[0], trailer: "https://assets.mixkit.co/videos/preview/mixkit-mysterious-foggy-spooky-forest-41618-large.mp4" } as IMovie;
    expect(toPublicMovie(stored).trailer).toBe("https://assets.mixkit.co/videos/41618/41618-720.mp4");
  });
});
