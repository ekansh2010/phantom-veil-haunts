import mongoose, { Model, Schema } from "mongoose";

/** Tracks when an external catalog was last synced, so serverless instances share the cache. */
export interface ISyncState {
  key: string;
  lastSuccessAt?: Date;
  lastAttemptAt?: Date;
  itemCount: number;
}

const SyncStateSchema = new Schema<ISyncState>(
  {
    key: { type: String, required: true, unique: true },
    lastSuccessAt: { type: Date },
    lastAttemptAt: { type: Date },
    itemCount: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const SyncState: Model<ISyncState> =
  (mongoose.models.SyncState as Model<ISyncState>) || mongoose.model<ISyncState>("SyncState", SyncStateSchema);
