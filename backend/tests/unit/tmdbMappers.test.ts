import { describe, expect, it } from "vitest";
import {
  mapTmdbDetails,
  mapTmdbListItem,
  mapWatchProviders,
  pickCertification,
  pickTrailerKey,
  providerRegions,
  scalePopularity,
} from "../../src/services/tmdb/mappers";
import { subgenreFilter, tagsFromKeywords } from "../../src/services/tmdb/subgenres";
import { buildPlan } from "../../src/services/tmdb/sync.service";
import { fixture } from "../tmdbMock";

const discover = fixture("discover-page1.json");
const details = fixture("movie-493922.json");

describe("mapTmdbListItem", () => {
  it("maps a discover result to the Movie model with full image URLs", () => {
    const m = mapTmdbListItem(discover.results[0]);
    expect(m).toMatchObject({
      id: "tmdb-493922",
      tmdbId: 493922,
      title: "Hereditary",
      originalTitle: "Hereditary",
      originalLanguage: "en",
      poster: "https://image.tmdb.org/t/p/w500/p9fmuz2Oj3HtEJEqbIwkFGUhVXD.jpg",
      backdrop: "https://image.tmdb.org/t/p/original/4GFPuL14eXi66V96xBWY73Y9PfR.jpg",
      rating: 7.3,
      voteCount: 8100,
      year: 2018,
      releaseDate: "2018-06-07",
      genre: "Horror, Mystery, Thriller",
      genres: ["Horror", "Mystery", "Thriller"],
      mediaType: "movie",
      source: "tmdb",
      isHorror: true,
      tmdbPopularity: 85.4,
    });
    expect(m!.popularity).toBeGreaterThan(50);
    expect(m!.popularity).toBeLessThanOrEqual(100);
  });

  it("falls back for missing images, flags non-horror and rejects unusable items", () => {
    const conjuring = mapTmdbListItem(discover.results[1])!;
    expect(conjuring.backdrop).toBe("");
    const notHorror = mapTmdbListItem(discover.results[3])!;
    expect(notHorror.isHorror).toBe(false);
    expect(notHorror.poster).toBe("/posters/poster3.jpg");
    expect(mapTmdbListItem(discover.results[4])).toBeNull();
    expect(mapTmdbListItem(null)).toBeNull();
    expect(mapTmdbListItem({ id: -3, title: "x" })).toBeNull();
  });

  it("rejects image paths that are not plain TMDB file paths", () => {
    expect(mapTmdbListItem({ id: 5, title: "X", poster_path: "javascript:alert(1)", genre_ids: [27] })!.poster).toBe("/posters/poster3.jpg");
  });
});

describe("scalePopularity", () => {
  it("is monotonic and bounded to 0-100", () => {
    expect(scalePopularity(0)).toBe(0);
    expect(scalePopularity("nope")).toBe(0);
    expect(scalePopularity(10)).toBeLessThan(scalePopularity(100));
    expect(scalePopularity(100)).toBeLessThan(scalePopularity(1000));
    expect(scalePopularity(1e9)).toBe(100);
  });
});

describe("mapTmdbDetails", () => {
  it("maps runtime, tagline, trailer, credits, certification, keywords and providers", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const { fields, tags } = mapTmdbDetails(details, providerRegions("IN"), now)!;
    expect(fields).toMatchObject({
      id: "tmdb-493922",
      runtime: 127,
      duration: "2h 07m",
      tagline: "Every family tree hides a secret.",
      imdbId: "tt7784604",
      trailerKey: "V6wWKNij_1M",
      directors: ["Ari Aster"],
      cast: ["Toni Collette", "Alex Wolff", "Milly Shapiro"],
      certification: "A",
      keywords: ["grief", "demon", "possession", "miniature"],
      detailsFetchedAt: now,
    });
    expect(fields.castDetails![0]).toEqual({ name: "Toni Collette", character: "Annie Graham", profile: "https://image.tmdb.org/t/p/w185/toni.jpg" });
    expect(fields.castDetails![2].profile).toBe("");
    expect(fields.providers).toEqual({
      region: "IN",
      link: "https://www.themoviedb.org/movie/493922-hereditary/watch?locale=IN",
      flatrate: [
        { id: 119, name: "Amazon Prime Video", logo: "https://image.tmdb.org/t/p/w92/prime.jpg" },
        { id: 122, name: "JioHotstar", logo: "https://image.tmdb.org/t/p/w92/hotstar.jpg" },
      ],
      rent: [],
      buy: [],
      free: [],
      ads: [],
    });
    expect(tags).toEqual(["supernatural"]);
  });

  it("uses the US fallback region when the primary has no providers", () => {
    const p = mapWatchProviders(details["watch/providers"], providerRegions("GB"))!;
    expect(p.region).toBe("US");
    expect(p.flatrate.map((x) => x.name)).toEqual(["Netflix"]);
    expect(mapWatchProviders({ results: {} }, ["IN", "US"])).toBeNull();
    expect(mapWatchProviders(undefined, ["IN"])).toBeNull();
  });

  it("prefers an official YouTube trailer, then any trailer, then a teaser", () => {
    expect(pickTrailerKey(details.videos)).toBe("V6wWKNij_1M");
    expect(pickTrailerKey({ results: [{ site: "YouTube", key: "teaserKEY01", type: "Teaser" }] })).toBe("teaserKEY01");
    expect(pickTrailerKey({ results: [{ site: "YouTube", key: "bad key!", type: "Trailer" }] })).toBeUndefined();
    expect(pickTrailerKey(undefined)).toBeUndefined();
  });

  it("picks the theatrical certification by region priority", () => {
    expect(pickCertification(details.release_dates, ["US", "IN"])).toBe("R");
    expect(pickCertification(details.release_dates, ["FR", "IN"])).toBe("A");
    expect(pickCertification(undefined, ["US"])).toBeUndefined();
  });
});

describe("sub-genres", () => {
  it("derives tags from keyword names", () => {
    expect(tagsFromKeywords(["masked killer", "zombie", "haunted house"])).toEqual(["slasher", "zombie", "haunted-house"]);
    expect(tagsFromKeywords(["romance"])).toEqual([]);
  });

  it("builds filters that match both TMDB tags and fallback genres", () => {
    expect(subgenreFilter("zombie")).toEqual({ $or: [{ subgenres: "zombie" }, { genre: /zombie/i }] });
    expect(subgenreFilter("classic")).toEqual({ $or: [{ subgenres: "classic" }, { genre: /classic/i }, { year: { $lt: 1980 } }] });
    expect(subgenreFilter("nope")).toBeNull();
  });
});

describe("buildPlan", () => {
  it("covers ~1000 popular titles plus sub-collections in full mode, and a light daily refresh", () => {
    const today = new Date("2026-11-23T00:00:00Z");
    const full = buildPlan("full", today);
    const daily = buildPlan("daily", today);
    expect(full.filter((s) => s.list === "popular")).toHaveLength(50);
    expect(new Set(full.map((s) => s.list))).toEqual(
      new Set(["popular", "top-rated", "now-playing", "upcoming", "classic", "supernatural", "psychological", "slasher", "zombie", "haunted-house"]),
    );
    expect(daily.length).toBeLessThan(25);
    expect(full.every((s) => s.params.with_genres?.startsWith("27"))).toBe(true);
    const upcoming = full.find((s) => s.list === "upcoming")!;
    expect(upcoming.params["primary_release_date.gte"]).toBe("2026-11-24");
    expect(full.find((s) => s.list === "zombie")).toMatchObject({ keywordNames: ["zombie"], tags: ["zombie"] });
    expect(full.find((s) => s.list === "psychological")!.params.with_genres).toBe("27,53");
  });
});
