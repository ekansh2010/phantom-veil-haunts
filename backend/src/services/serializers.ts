import type { IMovie, IUser } from "../models/index.js";
import { normalizeTrailerUrl } from "../data/catalog.js";

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  role: IUser["role"];
  favorite_genre: string;
  avatar_url: string;
  created_at: string;
}

export const toPublicUser = (u: Pick<IUser, "id" | "email" | "username" | "role" | "favoriteGenre" | "avatarUrl" | "createdAt">): PublicUser => ({
  id: u.id,
  email: u.email,
  username: u.username,
  role: u.role,
  favorite_genre: u.favoriteGenre ?? "",
  avatar_url: u.avatarUrl ?? "",
  created_at: new Date(u.createdAt).toISOString(),
});

export interface PublicMovie {
  id: string;
  title: string;
  poster: string;
  rating: number;
  duration: string;
  year: number;
  description: string;
  genre: string;
  cast: string[];
  trailer?: string;
  imdbId?: string;
  mediaType: IMovie["mediaType"];
  // TMDB library fields (present only when known)
  tmdbId?: number;
  originalTitle?: string;
  originalLanguage?: string;
  tagline?: string;
  backdrop?: string;
  releaseDate?: string;
  runtime?: number;
  genres?: string[];
  subgenres?: string[];
  voteCount?: number;
  certification?: string;
  trailerKey?: string;
  directors?: string[];
  // Detail-only fields
  castDetails?: IMovie["castDetails"];
  keywords?: string[];
  providers?: IMovie["providers"];
}

const OPTIONAL_FIELDS = [
  "tmdbId",
  "originalTitle",
  "originalLanguage",
  "tagline",
  "backdrop",
  "releaseDate",
  "runtime",
  "genres",
  "subgenres",
  "voteCount",
  "certification",
  "trailerKey",
  "directors",
] as const;
const DETAIL_FIELDS = ["castDetails", "keywords", "providers"] as const;

const isPresent = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/**
 * Shape the frontend `Movie` type expects (internal fields like source/popularity are hidden).
 * List views omit the heavy detail-only fields (full cast, keywords, providers).
 */
export const toPublicMovie = (m: IMovie, options: { detail?: boolean } = {}): PublicMovie => {
  const out: PublicMovie = {
    id: m.id,
    title: m.title,
    poster: m.poster,
    rating: m.rating,
    duration: m.duration,
    year: m.year,
    description: m.description,
    genre: m.genre,
    cast: m.cast ?? [],
    ...(m.trailer ? { trailer: normalizeTrailerUrl(m.trailer) } : {}),
    ...(m.imdbId ? { imdbId: m.imdbId } : {}),
    mediaType: m.mediaType,
  };
  const extra = out as unknown as Record<string, unknown>;
  for (const f of OPTIONAL_FIELDS) if (isPresent(m[f])) extra[f] = m[f];
  if (options.detail) for (const f of DETAIL_FIELDS) if (isPresent(m[f])) extra[f] = m[f];
  return out;
};

/** Array.map-safe list serializer (map passes the index as a second argument). */
export const toPublicMovieSummary = (m: IMovie): PublicMovie => toPublicMovie(m);
