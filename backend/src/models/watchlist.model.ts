import mongoose, { Model, Schema } from "mongoose";

export interface IWatchlistEntry {
  userId: string;
  movieId: string;
  createdAt: Date;
}

const WatchlistSchema = new Schema<IWatchlistEntry>(
  {
    userId: { type: String, required: true },
    movieId: { type: String, required: true },
  },
  { versionKey: false, timestamps: { createdAt: true, updatedAt: false } },
);

// One entry per (user, movie); also serves "list my watchlist" queries.
WatchlistSchema.index({ userId: 1, movieId: 1 }, { unique: true });
WatchlistSchema.index({ movieId: 1 });

export const WatchlistEntry: Model<IWatchlistEntry> =
  (mongoose.models.WatchlistEntry as Model<IWatchlistEntry>) ||
  mongoose.model<IWatchlistEntry>("WatchlistEntry", WatchlistSchema, "watchlist");
