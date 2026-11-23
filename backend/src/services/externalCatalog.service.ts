import { env, isTmdbConfigured } from "../config/env.js";
import { backupTrailerFor } from "../data/catalog.js";
import { IMovie, Movie, SyncState } from "../models/index.js";
import { logger } from "../utils/logger.js";
import { fetchAndStoreTmdbDetails, runTmdbSync } from "./tmdb/sync.service.js";

/** Time a page request may spend refreshing TMDB rows when the daily cron hasn't run. */
const ON_REQUEST_TMDB_BUDGET_MS = 4_000;

type MovieInput = Omit<IMovie, "createdAt" | "updatedAt">;

const FALLBACK_POSTER = "/posters/poster3.jpg";
const FETCH_TIMEOUT_MS = 5_000;
const RETRY_BACKOFF_MS = 10 * 60 * 1000;
const SYNC_KEY = "external-catalog";

/* eslint-disable @typescript-eslint/no-explicit-any -- third-party API payloads */

const fetchJson = async (url: string): Promise<any | null> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").trim();
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const yearOf = (date?: string | null) => {
  const y = date ? new Date(date).getFullYear() : NaN;
  return Number.isFinite(y) && y >= 1870 && y <= 2100 ? y : new Date().getFullYear();
};
const formatRuntime = (minutes?: number | null, fallback = "") => {
  if (!minutes || minutes <= 0) return fallback;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};

/** TVmaze show (or `{ show }` search hit) -> Movie. */
export const mapTvMazeShow = (item: any, fallbackGenre = "Horror"): MovieInput | null => {
  const show = item?.show ?? item;
  if (!show?.id || !show?.name) return null;
  const genre = Array.isArray(show.genres) && show.genres.length ? show.genres.join(", ") : fallbackGenre;
  const cast: string[] = Array.isArray(show._embedded?.cast)
    ? show._embedded.cast.slice(0, 4).map((c: any) => c?.person?.name).filter(Boolean)
    : [];
  const imdb = typeof show.externals?.imdb === "string" && /^tt\d{5,10}$/.test(show.externals.imdb) ? show.externals.imdb : undefined;
  return {
    id: `tv-${show.id}`,
    title: String(show.name).slice(0, 200),
    poster: show.image?.original || show.image?.medium || FALLBACK_POSTER,
    rating: Number(clamp(Number(show.rating?.average ?? 7), 0, 10).toFixed(1)),
    duration: formatRuntime(show.runtime ?? show.averageRuntime, "45m"),
    year: yearOf(show.premiered),
    description: show.summary ? stripHtml(String(show.summary)).slice(0, 5000) : "No description available in the dark.",
    genre: genre.slice(0, 200),
    cast,
    trailer: backupTrailerFor(genre),
    ...(imdb ? { imdbId: imdb } : {}),
    mediaType: "tv",
    source: "tvmaze",
    popularity: clamp(Number(show.weight ?? 50), 0, 100),
  };
};

const TVMAZE_QUERIES: Array<[string, string]> = [
  ["horror", "Horror"],
  ["ghost", "Supernatural Horror"],
  ["nightmare", "Psychological Horror"],
  ["zombie", "Zombie Apocalypse"],
  ["haunted", "Haunted House"],
];

const fetchTvMazeCatalog = async (): Promise<MovieInput[]> => {
  const results = await Promise.all(
    TVMAZE_QUERIES.map(async ([q, genre]) => {
      const hits = await fetchJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
      return Array.isArray(hits) ? hits.slice(0, 10).map((h) => mapTvMazeShow(h, genre)) : [];
    }),
  );
  return results.flat().filter((m): m is MovieInput => m !== null);
};

/** Upserts external titles in ONE bulk write. Admin/seed titles are never overwritten. */
const upsertMany = async (movies: MovieInput[]): Promise<number> => {
  const unique = [...new Map(movies.map((m) => [m.id, m])).values()];
  if (!unique.length) return 0;
  await Movie.bulkWrite(
    unique.map((m) => ({
      updateOne: { filter: { id: m.id, source: m.source }, update: { $set: m }, upsert: true },
    })),
    { ordered: false },
  ).catch((err) => {
    // A duplicate-key error means the id already belongs to a curated title; skip it.
    if ((err as { code?: number }).code !== 11000) throw err;
  });
  return unique.length;
};

/**
 * Refreshes the external catalog at most once per EXTERNAL_SYNC_TTL_HOURS
 * (tracked in MongoDB so every serverless instance shares it). Never throws.
 */
export const syncExternalCatalog = async (now: Date = new Date()): Promise<void> => {
  if (!env.EXTERNAL_CATALOG_ENABLED) return;
  try {
    const state = await SyncState.findOne({ key: SYNC_KEY }).lean();
    const ttlMs = env.EXTERNAL_SYNC_TTL_HOURS * 60 * 60 * 1000;
    if (state?.lastSuccessAt && now.getTime() - new Date(state.lastSuccessAt).getTime() < ttlMs) return;
    if (state?.lastAttemptAt && now.getTime() - new Date(state.lastAttemptAt).getTime() < RETRY_BACKOFF_MS) return;

    await SyncState.updateOne({ key: SYNC_KEY }, { $set: { lastAttemptAt: now } }, { upsert: true });
    if (isTmdbConfigured()) {
      // TMDB is the primary source: run (part of) the resumable daily refresh. A completed
      // pass marks this key as fresh; otherwise the next attempt after the back-off resumes it.
      const result = await runTmdbSync({ mode: "daily", budgetMs: ON_REQUEST_TMDB_BUDGET_MS, now: () => now });
      logger.info(result.message);
      return;
    }
    const movies = await fetchTvMazeCatalog();
    if (!movies.length) {
      logger.warn("External catalog sync returned no titles; serving stored catalog");
      return;
    }
    const count = await upsertMany(movies);
    await SyncState.updateOne({ key: SYNC_KEY }, { $set: { lastSuccessAt: now, itemCount: count } });
    logger.info(`External catalog synced (${count} titles)`);
  } catch (err) {
    logger.error("External catalog sync failed", err);
  }
};

/** Fetches a single external title on demand (e.g. a deep link to /movie/tv-123). */
export const fetchExternalMovie = async (id: string): Promise<IMovie | null> => {
  if (!env.EXTERNAL_CATALOG_ENABLED) return null;
  let mapped: MovieInput | null = null;

  const tv = /^tv-(\d{1,9})$/.exec(id);
  const tmdb = /^tmdb-(\d{1,9})$/.exec(id);
  if (tv) {
    mapped = mapTvMazeShow(await fetchJson(`https://api.tvmaze.com/shows/${tv[1]}?embed=cast`));
  } else if (tmdb) {
    if (!isTmdbConfigured()) return null;
    try {
      return await fetchAndStoreTmdbDetails(Number(tmdb[1]));
    } catch (err) {
      logger.warn(`TMDB lookup for ${id} failed`, err);
      return null;
    }
  }
  if (!mapped || mapped.id !== id) return null;

  return Movie.findOneAndUpdate({ id: mapped.id }, { $set: mapped }, { upsert: true, returnDocument: "after" }).lean<IMovie>();
};
