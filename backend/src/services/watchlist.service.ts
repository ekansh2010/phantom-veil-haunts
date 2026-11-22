import { IMovie, IWatchlistEntry, Movie, WatchlistEntry } from "../models/index.js";
import { HttpError } from "../utils/httpError.js";
import { fetchExternalMovie } from "./externalCatalog.service.js";
import { PublicMovie, toPublicMovie } from "./serializers.js";

export interface WatchlistItem {
  movie_id: string;
  added_at: string;
  movie: PublicMovie | null;
}

/** Lists the user's watchlist with movie details resolved in a single `$in` query (no N+1). */
export const listWatchlist = async (userId: string): Promise<WatchlistItem[]> => {
  const entries = await WatchlistEntry.find({ userId }).sort({ createdAt: -1 }).lean<IWatchlistEntry[]>();
  if (!entries.length) return [];
  const movies = await Movie.find({ id: { $in: entries.map((e) => e.movieId) } }).lean<IMovie[]>();
  const byId = new Map(movies.map((m) => [m.id, m]));
  return entries.map((e) => {
    const movie = byId.get(e.movieId);
    return { movie_id: e.movieId, added_at: new Date(e.createdAt).toISOString(), movie: movie ? toPublicMovie(movie) : null };
  });
};

const ensureMovieExists = async (movieId: string) => {
  if (await Movie.exists({ id: movieId })) return;
  if (await fetchExternalMovie(movieId)) return;
  throw HttpError.notFound("Movie not found");
};

export const addToWatchlist = async (userId: string, movieId: string): Promise<boolean> => {
  await ensureMovieExists(movieId);
  // Upsert is atomic and idempotent: concurrent adds never create duplicates.
  const res = await WatchlistEntry.updateOne({ userId, movieId }, { $setOnInsert: { userId, movieId } }, { upsert: true });
  return res.upsertedCount > 0;
};

export const removeFromWatchlist = async (userId: string, movieId: string): Promise<boolean> => {
  const { deletedCount } = await WatchlistEntry.deleteOne({ userId, movieId });
  return deletedCount > 0;
};

/** Legacy toggle used by the UI: removes if present, otherwise adds. */
export const toggleWatchlist = async (userId: string, movieId: string): Promise<boolean> => {
  if (await removeFromWatchlist(userId, movieId)) return false;
  await addToWatchlist(userId, movieId);
  return true;
};
