import type { CastMember, IMovie, WatchProvider, WatchProviders } from "../../models/index.js";
import { tagsFromKeywords } from "./subgenres.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- TMDB payloads are untyped JSON */

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
export const HORROR_GENRE_ID = 27;
export const FALLBACK_POSTER = "/posters/poster3.jpg";

/** TMDB's movie genre list (stable; avoids a /genre/movie/list call). */
export const TMDB_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

/** Fields written from a list/search/discover result (no runtime, cast, videos...). */
export type TmdbListFields = Pick<
  IMovie,
  | "id"
  | "tmdbId"
  | "title"
  | "originalTitle"
  | "originalLanguage"
  | "poster"
  | "backdrop"
  | "rating"
  | "voteCount"
  | "year"
  | "releaseDate"
  | "description"
  | "genre"
  | "genres"
  | "popularity"
  | "tmdbPopularity"
  | "mediaType"
  | "source"
  | "isHorror"
>;

/** Everything a detail call (with append_to_response) provides. */
export type TmdbDetailFields = TmdbListFields &
  Pick<
    IMovie,
    "runtime" | "duration" | "tagline" | "imdbId" | "trailerKey" | "directors" | "castDetails" | "cast" | "keywords" | "certification" | "providers" | "detailsFetchedAt"
  >;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const imageUrl = (path: unknown, size: "w92" | "w185" | "w500" | "original"): string =>
  typeof path === "string" && /^\/[\w.-]+$/.test(path) ? `${TMDB_IMAGE_BASE}/${size}${path}` : "";

/** TMDB popularity is unbounded (0..10k+); squash it onto the 0-100 scale used for ranking. */
export const scalePopularity = (raw: unknown): number => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(clamp(Math.log10(n + 1) * 33, 0, 100));
};

export const formatRuntime = (minutes?: number | null): string => {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};

const releaseDateOf = (v: unknown): string | undefined => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

const yearOf = (date: string | undefined): number => {
  const y = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(y) && y >= 1870 && y <= 2100 ? y : new Date().getFullYear();
};

const genreNamesOf = (item: any): string[] => {
  if (Array.isArray(item?.genres)) return item.genres.map((g: any) => str(g?.name, 50)).filter(Boolean);
  if (Array.isArray(item?.genre_ids)) return item.genre_ids.map((id: number) => TMDB_GENRES[id]).filter(Boolean);
  return [];
};

const genreIdsOf = (item: any): number[] => {
  if (Array.isArray(item?.genres)) return item.genres.map((g: any) => Number(g?.id)).filter(Number.isFinite);
  if (Array.isArray(item?.genre_ids)) return item.genre_ids.map(Number).filter(Number.isFinite);
  return [];
};

/** TMDB list item (discover / search / top_rated) -> Movie fields. null when unusable. */
export const mapTmdbListItem = (item: any): TmdbListFields | null => {
  const tmdbId = Number(item?.id);
  const title = str(item?.title, 200) || str(item?.original_title, 200);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !title) return null;

  const genres = genreNamesOf(item);
  const releaseDate = releaseDateOf(item.release_date);
  return {
    id: `tmdb-${tmdbId}`,
    tmdbId,
    title,
    originalTitle: str(item.original_title, 300) || title,
    originalLanguage: str(item.original_language, 10),
    poster: imageUrl(item.poster_path, "w500") || FALLBACK_POSTER,
    backdrop: imageUrl(item.backdrop_path, "original"),
    rating: Number(clamp(Number(item.vote_average) || 0, 0, 10).toFixed(1)),
    voteCount: Math.max(0, Math.round(Number(item.vote_count) || 0)),
    year: yearOf(releaseDate),
    releaseDate,
    description: str(item.overview, 5000) || "No description available in the dark.",
    genre: (genres.length ? genres.join(", ") : "Horror").slice(0, 200),
    genres,
    popularity: scalePopularity(item.popularity),
    tmdbPopularity: Math.max(0, Number(item.popularity) || 0),
    mediaType: "movie",
    source: "tmdb",
    isHorror: genreIdsOf(item).includes(HORROR_GENRE_ID),
  };
};

/** Picks the best YouTube trailer: official "Trailer" first, then any trailer, then a teaser. */
export const pickTrailerKey = (videos: any): string | undefined => {
  const list: any[] = Array.isArray(videos?.results) ? videos.results : [];
  const yt = list.filter((v) => v?.site === "YouTube" && typeof v?.key === "string" && /^[\w-]{6,20}$/.test(v.key));
  const score = (v: any) => (v.type === "Trailer" ? 4 : v.type === "Teaser" ? 1 : 0) + (v.official ? 2 : 0) + (v.iso_639_1 === "en" ? 1 : 0);
  const ranked = yt.filter((v) => v.type === "Trailer" || v.type === "Teaser").sort((a, b) => score(b) - score(a));
  return ranked[0]?.key;
};

/** Theatrical certification for the first region that has one (e.g. IN "A", US "R"). */
export const pickCertification = (releaseDates: any, regions: string[]): string | undefined => {
  const results: any[] = Array.isArray(releaseDates?.results) ? releaseDates.results : [];
  for (const region of regions) {
    const entry = results.find((r) => r?.iso_3166_1 === region);
    const dates: any[] = Array.isArray(entry?.release_dates) ? entry.release_dates : [];
    const sorted = [...dates].sort((a, b) => (a?.type === 3 ? -1 : 0) - (b?.type === 3 ? -1 : 0));
    const cert = sorted.map((d) => str(d?.certification, 20)).find(Boolean);
    if (cert) return cert;
  }
  return undefined;
};

const mapProviderList = (list: unknown): WatchProvider[] =>
  (Array.isArray(list) ? list : [])
    .filter((p: any) => Number.isFinite(Number(p?.provider_id)) && p?.provider_name)
    .sort((a: any, b: any) => (Number(a.display_priority) || 0) - (Number(b.display_priority) || 0))
    .slice(0, 12)
    .map((p: any) => ({ id: Number(p.provider_id), name: str(p.provider_name, 100), logo: imageUrl(p.logo_path, "w92") }));

/** Watch providers for the first region with data (default IN, then US). */
export const mapWatchProviders = (payload: any, regions: string[]): WatchProviders | null => {
  const results = payload?.results;
  if (!results || typeof results !== "object") return null;
  for (const region of regions) {
    const r = results[region];
    if (!r) continue;
    const mapped: WatchProviders = {
      region,
      ...(typeof r.link === "string" && /^https:\/\/www\.themoviedb\.org\//.test(r.link) ? { link: r.link } : {}),
      flatrate: mapProviderList(r.flatrate),
      rent: mapProviderList(r.rent),
      buy: mapProviderList(r.buy),
      free: mapProviderList(r.free),
      ads: mapProviderList(r.ads),
    };
    if (mapped.flatrate.length + mapped.rent.length + mapped.buy.length + mapped.free.length + mapped.ads.length) return mapped;
  }
  return null;
};

/** Provider regions in priority order: configured region, then US. */
export const providerRegions = (primary: string): string[] => [...new Set([primary.toUpperCase(), "US"])];

/**
 * TMDB movie details (fetched with append_to_response=videos,credits,release_dates,keywords,watch/providers)
 * -> Movie fields, plus sub-genre tags derived from keywords.
 */
export const mapTmdbDetails = (item: any, regions: string[], now: Date = new Date()): { fields: TmdbDetailFields; tags: string[] } | null => {
  const base = mapTmdbListItem(item);
  if (!base) return null;

  const crew: any[] = Array.isArray(item.credits?.crew) ? item.credits.crew : [];
  const castRaw: any[] = Array.isArray(item.credits?.cast) ? item.credits.cast : [];
  const castDetails: CastMember[] = castRaw
    .filter((c) => c?.name)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .slice(0, 12)
    .map((c) => ({ name: str(c.name, 100), character: str(c.character, 150), profile: imageUrl(c.profile_path, "w185") }));
  const directors = [...new Set(crew.filter((c) => c?.job === "Director" && c?.name).map((c) => str(c.name, 100)))].slice(0, 3);
  const keywordList: any[] = Array.isArray(item.keywords?.keywords) ? item.keywords.keywords : Array.isArray(item.keywords?.results) ? item.keywords.results : [];
  const keywords = keywordList.map((k) => str(k?.name, 60)).filter(Boolean).slice(0, 30);
  const runtime = Number(item.runtime) > 0 ? Math.round(Number(item.runtime)) : undefined;
  const imdb = typeof item.imdb_id === "string" && /^tt\d{5,10}$/.test(item.imdb_id) ? item.imdb_id : undefined;

  const fields: TmdbDetailFields = {
    ...base,
    runtime,
    duration: formatRuntime(runtime),
    tagline: str(item.tagline, 500) || undefined,
    imdbId: imdb,
    trailerKey: pickTrailerKey(item.videos),
    directors,
    castDetails,
    cast: castDetails.slice(0, 6).map((c) => c.name),
    keywords,
    certification: pickCertification(item.release_dates, regions),
    providers: mapWatchProviders(item["watch/providers"], regions),
    detailsFetchedAt: now,
  };
  return { fields, tags: tagsFromKeywords(keywords) };
};

/** Drops undefined values so a $set never unsets stored data. */
export const definedOnly = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
