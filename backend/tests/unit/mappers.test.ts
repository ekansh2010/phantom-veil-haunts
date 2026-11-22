import { describe, expect, it } from "vitest";
import { mapTmdbMovie, mapTvMazeShow } from "../../src/services/externalCatalog.service";

describe("mapTvMazeShow", () => {
  it("maps a search hit, stripping HTML and namespacing the id", () => {
    const m = mapTvMazeShow({
      score: 1,
      show: { id: 42, name: "Ghosts", genres: ["Comedy", "Supernatural"], rating: { average: 7.66 }, runtime: 95, premiered: "2021-10-07", summary: "<p>A <i>haunted</i> house.</p>", image: { original: "https://o.jpg", medium: "https://m.jpg" }, weight: 140, externals: { imdb: "tt11379026" } },
    });
    expect(m).toMatchObject({
      id: "tv-42", title: "Ghosts", genre: "Comedy, Supernatural", rating: 7.7, duration: "1h 35m", year: 2021,
      description: "A haunted house.", poster: "https://o.jpg", imdbId: "tt11379026", mediaType: "tv", source: "tvmaze", popularity: 100,
    });
  });

  it("falls back sensibly for sparse data and rejects invalid shows", () => {
    const m = mapTvMazeShow({ id: 1, name: "Bare", externals: { imdb: "javascript:x" } }, "Horror")!;
    expect(m.genre).toBe("Horror");
    expect(m.poster).toBe("/posters/poster3.jpg");
    expect(m.duration).toBe("45m");
    expect(m.imdbId).toBeUndefined();
    expect(mapTvMazeShow(null)).toBeNull();
    expect(mapTvMazeShow({ id: 2 })).toBeNull();
  });
});

describe("mapTmdbMovie", () => {
  it("maps a TMDB detail payload", () => {
    const m = mapTmdbMovie({
      id: 9, title: "Hereditary", vote_average: 7.33, runtime: 127, release_date: "2018-06-07", overview: "Grief.", poster_path: "/p.jpg",
      genres: [{ name: "Horror" }, { name: "Mystery" }], credits: { cast: [{ name: "Toni Collette" }] }, imdb_id: "tt7784604", popularity: 250,
    });
    expect(m).toMatchObject({
      id: "tmdb-9", title: "Hereditary", rating: 7.3, duration: "2h 07m", year: 2018, poster: "https://image.tmdb.org/t/p/w500/p.jpg",
      genre: "Horror, Mystery", cast: ["Toni Collette"], imdbId: "tt7784604", mediaType: "movie", source: "tmdb", popularity: 100,
    });
  });

  it("returns null without id/title", () => {
    expect(mapTmdbMovie({ id: 1 })).toBeNull();
  });
});
