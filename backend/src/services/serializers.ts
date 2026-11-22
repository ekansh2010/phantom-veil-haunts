import type { IMovie, IUser } from "../models/index.js";

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
}

/** Shape the frontend `Movie` type expects (internal fields like source/popularity are hidden). */
export const toPublicMovie = (m: IMovie): PublicMovie => ({
  id: m.id,
  title: m.title,
  poster: m.poster,
  rating: m.rating,
  duration: m.duration,
  year: m.year,
  description: m.description,
  genre: m.genre,
  cast: m.cast ?? [],
  ...(m.trailer ? { trailer: m.trailer } : {}),
  ...(m.imdbId ? { imdbId: m.imdbId } : {}),
  mediaType: m.mediaType,
});
