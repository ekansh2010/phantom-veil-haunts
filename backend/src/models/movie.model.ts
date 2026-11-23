import mongoose, { Model, Schema } from "mongoose";

export type MovieSource = "seed" | "admin" | "tvmaze" | "tmdb";
export type MediaType = "movie" | "tv";

export interface CastMember {
  name: string;
  character?: string;
  /** Full profile image URL (TMDB), or empty. */
  profile?: string;
}

export interface WatchProvider {
  id: number;
  name: string;
  /** Full logo URL (TMDB). */
  logo: string;
}

/** Streaming availability for one region (data from TMDB, powered by JustWatch). */
export interface WatchProviders {
  region: string;
  /** TMDB "where to watch" page for the title (required attribution link). */
  link?: string;
  flatrate: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  free: WatchProvider[];
  ads: WatchProvider[];
}

export interface IMovie {
  /** Public id. Seeded titles use "1".."8"; external ones are namespaced ("tv-123", "tmdb-456"). */
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
  mediaType: MediaType;
  source: MovieSource;
  /** Ranking signal for "Trending" (0-100). */
  popularity: number;

  // ---- TMDB library fields (optional; bundled/TVmaze titles leave them empty) ----
  tmdbId?: number;
  originalTitle?: string;
  originalLanguage?: string;
  tagline?: string;
  backdrop?: string;
  /** "YYYY-MM-DD" (sorts lexicographically). */
  releaseDate?: string;
  /** Minutes. */
  runtime?: number;
  genres?: string[];
  voteCount?: number;
  /** Raw TMDB popularity score (unbounded). */
  tmdbPopularity?: number;
  certification?: string;
  /** YouTube video key of the official trailer. */
  trailerKey?: string;
  directors?: string[];
  castDetails?: CastMember[];
  keywords?: string[];
  /** Normalised sub-genre tags used by rows and browse filters (e.g. "slasher"). */
  subgenres?: string[];
  providers?: WatchProviders | null;
  /** false for non-horror titles (e.g. deep links); they are hidden from rows/browse. */
  isHorror?: boolean;
  /** When videos/credits/providers were last fetched (lazy detail cache). */
  detailsFetchedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const ProviderSchema = new Schema<WatchProvider>({ id: Number, name: String, logo: String }, { _id: false });

const MovieSchema = new Schema<IMovie>(
  {
    id: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    poster: { type: String, default: "", maxlength: 2048 },
    rating: { type: Number, min: 0, max: 10, default: 0 },
    duration: { type: String, default: "", maxlength: 20 },
    year: { type: Number, min: 1870, max: 2100 },
    description: { type: String, default: "", maxlength: 5000 },
    genre: { type: String, default: "Horror", maxlength: 200 },
    cast: { type: [String], default: [] },
    trailer: { type: String, maxlength: 2048 },
    imdbId: { type: String, maxlength: 20 },
    mediaType: { type: String, enum: ["movie", "tv"], default: "movie" },
    source: { type: String, enum: ["seed", "admin", "tvmaze", "tmdb"], default: "admin", index: true },
    popularity: { type: Number, default: 0, min: 0, max: 100 },

    tmdbId: { type: Number },
    originalTitle: { type: String, maxlength: 300 },
    originalLanguage: { type: String, maxlength: 10 },
    tagline: { type: String, maxlength: 500 },
    backdrop: { type: String, maxlength: 2048 },
    releaseDate: { type: String, maxlength: 10 },
    runtime: { type: Number, min: 0 },
    genres: { type: [String], default: undefined },
    voteCount: { type: Number, min: 0 },
    tmdbPopularity: { type: Number, min: 0 },
    certification: { type: String, maxlength: 20 },
    trailerKey: { type: String, maxlength: 50 },
    directors: { type: [String], default: undefined },
    castDetails: {
      type: [new Schema<CastMember>({ name: String, character: String, profile: String }, { _id: false })],
      default: undefined,
    },
    keywords: { type: [String], default: undefined },
    subgenres: { type: [String], default: undefined },
    providers: {
      type: new Schema<WatchProviders>(
        {
          region: String,
          link: String,
          flatrate: [ProviderSchema],
          rent: [ProviderSchema],
          buy: [ProviderSchema],
          free: [ProviderSchema],
          ads: [ProviderSchema],
        },
        { _id: false },
      ),
      default: undefined,
    },
    isHorror: { type: Boolean },
    detailsFetchedAt: { type: Date },
  },
  { versionKey: false, timestamps: true },
);

MovieSchema.index({ popularity: -1, rating: -1 });
MovieSchema.index({ year: -1, rating: -1 });
MovieSchema.index({ rating: -1 });
// Upsert key for TMDB titles; sparse so bundled/TVmaze titles (no tmdbId) don't collide.
MovieSchema.index({ tmdbId: 1 }, { unique: true, sparse: true });
MovieSchema.index({ subgenres: 1, popularity: -1 });
MovieSchema.index({ releaseDate: -1 });

export const Movie: Model<IMovie> = (mongoose.models.Movie as Model<IMovie>) || mongoose.model<IMovie>("Movie", MovieSchema);
