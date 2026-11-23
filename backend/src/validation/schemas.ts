import { z } from "zod";
import { SUBGENRE_KEYS } from "../services/tmdb/subgenres.js";

// ---------- shared ----------

/** http(s) URLs or root-relative paths (bundled assets). Blocks javascript:/data: etc. */
export const safeUrl = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v) || /^\/[^\s/][^\s]*$/.test(v), "Must be an http(s) URL or a site-relative path");

export const movieIdRule = z
  .string()
  .trim()
  .min(1, "movie_id is required")
  .max(100, "movie_id is too long")
  .regex(/^[A-Za-z0-9_-]+$/, "movie_id contains invalid characters");

export const movieIdParams = z.object({ id: movieIdRule });
export const watchlistParams = z.object({ movieId: movieIdRule });
export const userIdParams = z.object({ id: z.string().trim().min(1).max(100) });

const pageQuery = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

// ---------- auth ----------

export const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be at most 128 characters long")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");

const email = z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Email must be valid").max(254);

export const usernameRule = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[A-Za-z0-9_.-]+$/, "Username may only contain letters, numbers, '_', '.' and '-'");

export const registerSchema = z.object({
  email,
  password: passwordRule,
  // Optional: derived from the email when omitted (matches the original Supabase trigger).
  username: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), usernameRule.optional()),
});

export const loginSchema = z.object({
  email,
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required").max(128),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{64}$/i, "Reset link is invalid or has expired."),
  password: passwordRule,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(128),
  newPassword: passwordRule,
});

// ---------- profile ----------

export const updateProfileSchema = z
  .object({
    username: usernameRule.optional(),
    favorite_genre: z.string().trim().max(50, "Favorite genre is too long").optional(),
    avatar_url: safeUrl.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Provide at least one field to update");

// ---------- watchlist ----------

export const toggleWatchlistSchema = z.object({ movie_id: movieIdRule });

// ---------- movies ----------

export const searchMoviesQuery = z.object({
  q: z.string().trim().max(100, "Search query is too long").optional().default(""),
  genre: z.string().trim().max(50).optional().default(""),
  ...pageQuery,
});

/** Empty query values ("?decade=") mean "no filter". */
const optionalNumber = (schema: z.ZodType<number>) => z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.coerce.number().pipe(schema).optional());

export const browseMoviesQuery = z.object({
  subgenre: z.preprocess((v) => (v === "" ? undefined : v), z.enum(SUBGENRE_KEYS).optional()),
  decade: optionalNumber(
    z
      .number()
      .int()
      .min(1900)
      .max(2100)
      .refine((d) => d % 10 === 0, "decade must be a multiple of 10"),
  ),
  yearFrom: optionalNumber(z.number().int().min(1870).max(2100)),
  yearTo: optionalNumber(z.number().int().min(1870).max(2100)),
  minRating: optionalNumber(z.number().min(0).max(10)),
  sort: z.enum(["popularity", "rating", "newest", "oldest", "title"]).default("popularity"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

const movieFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  poster: safeUrl.default(""),
  rating: z.coerce.number().min(0).max(10).default(0),
  duration: z.string().trim().max(20).default(""),
  year: z.coerce.number().int().min(1870).max(2100),
  description: z.string().trim().max(5000).default(""),
  genre: z.string().trim().min(1).max(200).default("Horror"),
  cast: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  trailer: safeUrl.optional(),
  imdbId: z
    .string()
    .trim()
    .regex(/^tt\d{5,10}$/, "imdbId must look like tt1234567")
    .optional(),
  mediaType: z.enum(["movie", "tv"]).default("movie"),
  popularity: z.coerce.number().min(0).max(100).default(50),
};

export const createMovieSchema = z.object(movieFields);

export const updateMovieSchema = z
  .object({
    title: movieFields.title.optional(),
    poster: safeUrl.optional(),
    rating: z.coerce.number().min(0).max(10).optional(),
    duration: z.string().trim().max(20).optional(),
    year: z.coerce.number().int().min(1870).max(2100).optional(),
    description: z.string().trim().max(5000).optional(),
    genre: z.string().trim().min(1).max(200).optional(),
    cast: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    trailer: safeUrl.optional(),
    imdbId: movieFields.imdbId,
    mediaType: z.enum(["movie", "tv"]).optional(),
    popularity: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Provide at least one field to update");

// ---------- admin ----------

export const listUsersQuery = z.object({
  q: z.string().trim().max(100).optional().default(""),
  ...pageQuery,
});

export const updateRoleSchema = z.object({ role: z.enum(["user", "admin"]) });

export const tmdbSyncSchema = z.object({
  mode: z.enum(["daily", "full"]).default("daily"),
  reset: z.boolean().default(false),
});
