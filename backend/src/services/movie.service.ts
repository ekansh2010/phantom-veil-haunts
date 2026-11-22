import { backupTrailerFor } from "../data/catalog.js";
import { IMovie, Movie, WatchlistEntry } from "../models/index.js";
import { HttpError } from "../utils/httpError.js";
import { escapeRegex, generateId, paginate } from "../utils/helpers.js";
import { fetchExternalMovie, syncExternalCatalog } from "./externalCatalog.service.js";
import { PublicMovie, toPublicMovie } from "./serializers.js";

export interface Category {
  title: string;
  movies: PublicMovie[];
}

type SortSpec = Record<string, 1 | -1>;

/** Home-page rows. Patterns are static (never user input). */
const CATEGORY_DEFS: Array<{ title: string; genre?: RegExp; sort: SortSpec }> = [
  { title: "Trending Horror", sort: { popularity: -1, rating: -1 } },
  { title: "New Nightmares", sort: { year: -1, rating: -1 } },
  { title: "Supernatural Horror", genre: /supernatural|ghost|paranormal/i, sort: { rating: -1 } },
  { title: "Psychological Horror", genre: /psycholog|thriller|mystery/i, sort: { rating: -1 } },
  { title: "Classic Horror", genre: /classic/i, sort: { rating: -1 } },
  { title: "Zombie Apocalypse", genre: /zombie/i, sort: { rating: -1 } },
  { title: "Haunted House", genre: /haunted|house/i, sort: { rating: -1 } },
];

const ROW_SIZE = 10;

export const getCategories = async (): Promise<Category[]> => {
  await syncExternalCatalog();
  // A fixed number of bounded queries (one per row) in parallel, independent of catalog size.
  const rows = await Promise.all(
    CATEGORY_DEFS.map(async (def) => {
      const movies = await Movie.find(def.genre ? { genre: def.genre } : {})
        .sort({ ...def.sort, id: 1 })
        .limit(ROW_SIZE)
        .lean<IMovie[]>();
      return { title: def.title, movies: movies.map(toPublicMovie) };
    }),
  );
  return rows.filter((r) => r.movies.length > 0);
};

export const getMovie = async (id: string): Promise<PublicMovie> => {
  const movie = (await Movie.findOne({ id }).lean<IMovie>()) ?? (await fetchExternalMovie(id));
  if (!movie) throw HttpError.notFound("Movie not found");
  return toPublicMovie(movie);
};

export const getSimilar = async (id: string, limit = 8): Promise<PublicMovie[]> => {
  const movie = await Movie.findOne({ id }, { genre: 1 }).lean<Pick<IMovie, "genre">>();
  if (!movie) throw HttpError.notFound("Movie not found");

  const genres = movie.genre
    .split(/[,/]/)
    .map((g) => g.trim())
    .filter(Boolean);
  const pattern = genres.length ? new RegExp(genres.map(escapeRegex).join("|"), "i") : null;

  const similar = pattern
    ? await Movie.find({ id: { $ne: id }, genre: pattern }).sort({ rating: -1, id: 1 }).limit(limit).lean<IMovie[]>()
    : [];
  if (similar.length < limit) {
    // Top up with the best-rated titles so the row is never empty.
    const exclude = [id, ...similar.map((m) => m.id)];
    const extra = await Movie.find({ id: { $nin: exclude } }).sort({ rating: -1, id: 1 }).limit(limit - similar.length).lean<IMovie[]>();
    similar.push(...extra);
  }
  return similar.map(toPublicMovie);
};

export const searchMovies = async (q: string, genre: string, page: number, limit: number) => {
  const filter: Record<string, unknown> = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ title: rx }, { description: rx }, { genre: rx }, { cast: rx }];
  }
  if (genre) filter.genre = new RegExp(escapeRegex(genre), "i");

  const { skip } = paginate(page, limit);
  const [items, total] = await Promise.all([
    Movie.find(filter).sort({ popularity: -1, rating: -1, id: 1 }).skip(skip).limit(limit).lean<IMovie[]>(),
    Movie.countDocuments(filter),
  ]);
  return { items: items.map(toPublicMovie), total, page, limit, totalPages: Math.ceil(total / limit) };
};

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
