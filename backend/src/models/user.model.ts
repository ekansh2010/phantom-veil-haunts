import mongoose, { HydratedDocument, Model, Schema } from "mongoose";

export type Role = "user" | "admin";

export interface IUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: Role;
  favoriteGenre: string;
  avatarUrl: string;
  /** Embedded in JWTs; incrementing it revokes every previously issued token. */
  tokenVersion: number;
  /** SHA-256 of the reset token (the raw token is only ever sent to the user). */
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

const UserSchema = new Schema<IUser>(
  {
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    username: { type: String, required: true, trim: true, maxlength: 30 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    favoriteGenre: { type: String, default: "", maxlength: 50 },
    avatarUrl: { type: String, default: "", maxlength: 2048 },
    tokenVersion: { type: Number, default: 0 },
    resetPasswordToken: { type: String, index: true, sparse: true },
    resetPasswordExpires: { type: Date },
  },
  { versionKey: false, timestamps: true },
);

// Usernames are unique case-insensitively.
UserSchema.index({ username: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const User: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>("User", UserSchema);
