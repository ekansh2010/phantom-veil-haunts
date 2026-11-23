import { isTmdbConfigured } from "../config/env.js";
import { backupTrailerFor } from "../data/catalog.js";
import { IMovie, Movie, WatchlistEntry } from "../models/index.js";
import { HttpError } from "../utils/httpError.js";
import { escapeRegex, generateId, paginate } from "../utils/helpers.js";
import { logger } from "../utils/logger.js";
import { fetchExternalMovie, syncExternalCatalog } from "./externalCatalog.service.js";
import { PublicMovie, toPublicMovie, toPublicMovieSummary } from "./serializers.js";
import { SUBGENRES, subgenreFilter } from "./tmdb/subgenres.js";
import { ensureTmdbDetails, searchTmdbAndStore } from "./tmdb/sync.service.js";

export interface Category {
  /** Stable row key; also a browse filter (`/browse?subgenre=<key>` or `?sort=<key>`). */
  key: string;
  title: string;
  movies: PublicMovie[];
}

type SortSpec = Record<string, 1 | -1>;
type Filter = Record<string, unknown>;

/** Titles flagged non-horror (e.g. reached through a deep link) never appear in rows or browse. */
const HORROR_ONLY: Filter = { isHorror: { $ne: false } };

export type CatalogMode = "tmdb" | "fallback";

/** TMDB is the primary source once it is configured and at least one TMDB title is stored. */
export const getCatalogMode = async (): Promise<CatalogMode> =>
  isTmdbConfigured() && (await Movie.exists({ source: "tmdb", ...HORROR_ONLY })) ? "tmdb" : "fallback";

/** Bundled + TVmaze rows (unchanged behaviour when TMDB isn't configured). Patterns are static. */
const FALLBACK_ROWS: Array<{ key: string; title: string; genre?: RegExp; sort: SortSpec }> = [
  { key: "trending", title: "Trending Horror", sort: { popularity: -1, rating: -1 } },
  { key: "new", title: "New Nightmares", sort: { year: -1, rating: -1 } },
  { key: "supernatural", title: "Supernatural Horror", genre: /supernatural|ghost|paranormal/i, sort: { rating: -1 } },
  { key: "psychological", title: "Psychological Horror", genre: /psycholog|thriller|mystery/i, sort: { rating: -1 } },
  { key: "classic", title: "Classic Horror", genre: /classic/i, sort: { rating: -1 } },
  { key: "zombie", title: "Zombie Apocalypse", genre: /zombie/i, sort: { rating: -1 } },
  { key: "haunted-house", title: "Haunted House", genre: /haunted|house/i, sort: { rating: -1 } },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const POPULAR: SortSpec = { popularity: -1, tmdbPopularity: -1, rating: -1 };

/** TMDB library rows (Trending, New, Top rated, sub-genres, Classic, Coming soon). */
const tmdbRows = (now: Date): Array<{ key: string; title: string; filter: Filter; sort: SortSpec }> => {
  const today = isoDate(now);
  return [
    { key: "trending", title: "Trending Horror", filter: {}, sort: POPULAR },
    { key: "new", title: "New Nightmares", filter: { releaseDate: { $gte: isoDate(new Date(now.getTime() - 180 * DAY_MS)), $lte: today } }, sort: POPULAR },
    { key: "top-rated", title: "Top Rated Terror", filter: { voteCount: { $gte: 300 } }, sort: { rating: -1, voteCount: -1 } },
    { key: "supernatural", title: "Supernatural Horror", filter: { subgenres: "supernatural" }, sort: POPULAR },
    { key: "psychological", title: "Psychological Horror", filter: { subgenres: "psychological" }, sort: POPULAR },
    { key: "slasher", title: "Slasher", filter: { subgenres: "slasher" }, sort: POPULAR },
    { key: "zombie", title: "Zombie Apocalypse", filter: { subgenres: "zombie" }, sort: POPULAR },
    { key: "haunted-house", title: "Haunted House", filter: { subgenres: "haunted-house" }, sort: POPULAR },
    { key: "classic", title: "Classic Horror", filter: { year: { $lt: 1980 } }, sort: { voteCount: -1, rating: -1 } },
    { key: "upcoming", title: "Coming Soon", filter: { releaseDate: { $gt: today } }, sort: POPULAR },
  ];
};

const FALLBACK_ROW_SIZE = 10;
const TMDB_ROW_SIZE = 20;

export const getCategories = async (now: Date = new Date()): Promise<Category[]> => {
  await syncExternalCatalog();
  const mode = await getCatalogMode();
  const defs: Array<{ key: string; title: string; filter: Filter; sort: SortSpec; size: number }> =
    mode === "tmdb"
      ? tmdbRows(now).map((d) => ({ ...d, filter: { source: "tmdb", ...HORROR_ONLY, ...d.filter }, size: TMDB_ROW_SIZE }))
      : FALLBACK_ROWS.map((d) => ({ key: d.key, title: d.title, filter: { ...HORROR_ONLY, ...(d.genre ? { genre: d.genre } : {}) }, sort: d.sort, size: FALLBACK_ROW_SIZE }));

  // A fixed number of bounded queries (one per row) in parallel, independent of catalog size.
  const rows = await Promise.all(
    defs.map(async (def) => {
      const movies = await Movie.find(def.filter).sort({ ...def.sort, id: 1 }).limit(def.size).lean<IMovie[]>();
      return { key: def.key, title: def.title, movies: movies.map(toPublicMovieSummary) };
    }),
  );
  return rows.filter((r) => r.movies.length > 0);
};

export const getMovie = async (id: string): Promise<PublicMovie> => {
  const stored = await Movie.findOne({ id }).lean<IMovie>();
  // Stored TMDB titles get videos/credits/providers lazily on first view (then cached).
  const movie = stored ? await ensureTmdbDetails(stored) : await fetchExternalMovie(id);
  if (!movie) throw HttpError.notFound("Movie not found");
  return toPublicMovie(movie, { detail: true });
};

export const getSimilar = async (id: string, limit = 8): Promise<PublicMovie[]> => {
  const movie = await Movie.findOne({ id }, { genre: 1, subgenres: 1, source: 1 }).lean<Pick<IMovie, "genre" | "subgenres" | "source">>();
  if (!movie) throw HttpError.notFound("Movie not found");

  const base: Filter = { id: { $ne: id }, ...HORROR_ONLY };
  let similar: IMovie[] = [];
  if (movie.source === "tmdb" && movie.subgenres?.length) {
    // Same sub-genre first for TMDB titles (genre strings are too broad: they all say "Horror").
    similar = await Movie.find({ ...base, source: "tmdb", subgenres: { $in: movie.subgenres } })
      .sort({ ...POPULAR, id: 1 })
      .limit(limit)
      .lean<IMovie[]>();
  } else {
    const genres = movie.genre
      .split(/[,/]/)
      .map((g) => g.trim())
      .filter(Boolean);
    const pattern = genres.length ? new RegExp(genres.map(escapeRegex).join("|"), "i") : null;
    similar = pattern ? await Movie.find({ ...base, genre: pattern }).sort({ rating: -1, id: 1 }).limit(limit).lean<IMovie[]>() : [];
  }
  if (similar.length < limit) {
    // Top up with the best-rated titles so the row is never empty.
    const exclude = [id, ...similar.map((m) => m.id)];
    const extra = await Movie.find({ ...HORROR_ONLY, id: { $nin: exclude } })
      .sort({ rating: -1, id: 1 })
      .limit(limit - similar.length)
      .lean<IMovie[]>();
    similar.push(...extra);
  }
  return similar.map(toPublicMovieSummary);
};

const buildSearchFilter = (q: string, genre: string): Filter => {
  const filter: Filter = { ...HORROR_ONLY };
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: rx }, { originalTitle: rx }, { description: rx }, { genre: rx }, { cast: rx }, { directors: rx }];
  }
  if (genre) filter.genre = new RegExp(escapeRegex(genre), "i");
  return filter;
};

export const searchMovies = async (q: string, genre: string, page: number, limit: number) => {
  const filter = buildSearchFilter(q, genre);
  const run = async () => {
    const { skip } = paginate(page, limit);
    return Promise.all([
      Movie.find(filter).sort({ popularity: -1, rating: -1, id: 1 }).skip(skip).limit(limit).lean<IMovie[]>(),
      Movie.countDocuments(filter),
    ]);
  };

  let [items, total] = await run();
  // Few local hits: ask TMDB (horror results only), store them, and query again.
  if (q && page === 1 && total < limit && isTmdbConfigured()) {
    try {
      if ((await searchTmdbAndStore(q)) > 0) [items, total] = await run();
    } catch (err) {
      logger.warn("TMDB search fallback failed; returning local results", err);
    }
  }
  return { items: items.map(toPublicMovieSummary), total, page, limit, totalPages: Math.ceil(total / limit) };
};

// ---------------------------------------------------------------------------
// Browse (filters + sort + pagination), for both data sources
// ---------------------------------------------------------------------------

export const BROWSE_SORTS = ["popularity", "rating", "newest", "oldest", "title"] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

export interface BrowseQuery {
  subgenre?: string;
  decade?: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  sort: BrowseSort;
  page: number;
  limit: number;
}

const BROWSE_SORT_SPECS: Record<BrowseSort, SortSpec> = {
  popularity: POPULAR,
  rating: { rating: -1, voteCount: -1 },
  newest: { year: -1, releaseDate: -1 },
  oldest: { year: 1, releaseDate: 1 },
  title: { title: 1 },
};

/** TMDB titles with only a handful of votes would otherwise dominate "top rated". */
const MIN_VOTES_FOR_RATING = 50;

export const browseMovies = async (query: BrowseQuery, now: Date = new Date()) => {
  const mode = await getCatalogMode();
  const and: Filter[] = [HORROR_ONLY];
  if (mode === "tmdb") and.push({ source: "tmdb" });

  if (query.subgenre) {
    const f = subgenreFilter(query.subgenre);
    if (f) and.push(f);
  }
  const year: Record<string, number> = {};
  if (query.decade) Object.assign(year, { $gte: query.decade, $lte: query.decade + 9 });
  if (query.yearFrom) year.$gte = Math.max(year.$gte ?? 0, query.yearFrom);
  if (query.yearTo) year.$lte = Math.min(year.$lte ?? 9999, query.yearTo);
  if (Object.keys(year).length) and.push({ year });
  if (query.minRating) and.push({ rating: { $gte: query.minRating } });
  if (mode === "tmdb" && (query.sort === "rating" || query.minRating)) and.push({ voteCount: { $gte: MIN_VOTES_FOR_RATING } });
  // Unreleased titles have no rating yet; keep them out of "newest" unless a year range is given.
  if (query.sort === "newest" && mode === "tmdb" && !query.yearTo && !query.decade) {
    and.push({ $or: [{ releaseDate: { $lte: isoDate(now) } }, { releaseDate: { $exists: false } }] });
  }

  const filter = { $and: and };
  const { skip } = paginate(query.page, query.limit);
  const [items, total] = await Promise.all([
    Movie.find(filter)
      .sort({ ...BROWSE_SORT_SPECS[query.sort], id: 1 })
      .skip(skip)
      .limit(query.limit)
      .lean<IMovie[]>(),
    Movie.countDocuments(filter),
  ]);
  return { items: items.map(toPublicMovieSummary), total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit), source: mode };
};

/** What the UI needs to render filters and attribution. */
export const getCatalogMeta = async () => ({
  source: await getCatalogMode(),
  tmdbConfigured: isTmdbConfigured(),
  subgenres: SUBGENRES.map((s) => ({ key: s.key, label: s.label })),
  sorts: [...BROWSE_SORTS],
});

// ---------------------------------------------------------------------------
// Admin catalog management
// ---------------------------------------------------------------------------

export type MovieWriteInput = Partial<Omit<IMovie, "id" | "source" | "createdAt" | "updatedAt">>;

export const createMovie = async (input: MovieWriteInput & { title: string; year: number }): Promise<PublicMovie> => {
  const movie = await Movie.create({
    ...input,
    id: generateId("pv"),
    source: "admin",
    trailer: input.trailer || backupTrailerFor(input.genre),
  });
  return toPublicMovie(movie.toObject());
};

export const updateMovie = async (id: string, input: MovieWriteInput): Promise<PublicMovie> => {
  const movie = await Movie.findOneAndUpdate({ id }, { $set: input }, { returnDocument: "after", runValidators: true }).lean<IMovie>();
  if (!movie) throw HttpError.notFound("Movie not found");
  return toPublicMovie(movie);
};

export const deleteMovie = async (id: string): Promise<void> => {
  const { deletedCount } = await Movie.deleteOne({ id });
  if (!deletedCount) throw HttpError.notFound("Movie not found");
  await WatchlistEntry.deleteMany({ movieId: id });
};
