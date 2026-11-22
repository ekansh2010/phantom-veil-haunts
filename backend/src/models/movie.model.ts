import mongoose, { Model, Schema } from "mongoose";

export type MovieSource = "seed" | "admin" | "tvmaze" | "tmdb";
export type MediaType = "movie" | "tv";

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { versionKey: false, timestamps: true },
);

MovieSchema.index({ popularity: -1, rating: -1 });
MovieSchema.index({ year: -1, rating: -1 });
MovieSchema.index({ rating: -1 });

export const Movie: Model<IMovie> = (mongoose.models.Movie as Model<IMovie>) || mongoose.model<IMovie>("Movie", MovieSchema);
