import mongoose, { Model, Schema } from "mongoose";

/** Tracks when an external catalog was last synced, so serverless instances share the cache. */
export interface ISyncState {
  key: string;
  lastSuccessAt?: Date;
  lastAttemptAt?: Date;
  itemCount: number;
  /** Resumable position in a multi-step import plan (TMDB sync runs in small batches). */
  cursor?: number;
  /** Total steps in the plan the cursor refers to. */
  total?: number;
  /** Titles upserted since the plan (re)started. */
  runCount?: number;
  lastError?: string;
}

const SyncStateSchema = new Schema<ISyncState>(
  {
    key: { type: String, required: true, unique: true },
    lastSuccessAt: { type: Date },
    lastAttemptAt: { type: Date },
    itemCount: { type: Number, default: 0 },
    cursor: { type: Number, default: 0 },
    total: { type: Number },
    runCount: { type: Number, default: 0 },
    lastError: { type: String, maxlength: 500 },
  },
  { versionKey: false },
);

export const SyncState: Model<ISyncState> =
  (mongoose.models.SyncState as Model<ISyncState>) || mongoose.model<ISyncState>("SyncState", SyncStateSchema);
