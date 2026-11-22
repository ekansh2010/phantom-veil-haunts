import { User } from "../models/index.js";
import { HttpError } from "../utils/httpError.js";
import { CASE_INSENSITIVE } from "../utils/helpers.js";
import { PublicUser, toPublicUser } from "./serializers.js";

export interface ProfileUpdate {
  username?: string;
  favorite_genre?: string;
  avatar_url?: string;
}

export const getProfile = async (userId: string): Promise<PublicUser> => {
  const user = await User.findOne({ id: userId }).lean();
  if (!user) throw HttpError.notFound("Profile not found");
  return toPublicUser(user);
};

export const updateProfile = async (userId: string, input: ProfileUpdate): Promise<PublicUser> => {
  if (input.username && (await User.exists({ username: input.username, id: { $ne: userId } }).collation(CASE_INSENSITIVE))) {
    throw HttpError.conflict("Username is already taken");
  }
  const $set: Record<string, string> = {};
  if (input.username !== undefined) $set.username = input.username;
  if (input.favorite_genre !== undefined) $set.favoriteGenre = input.favorite_genre;
  if (input.avatar_url !== undefined) $set.avatarUrl = input.avatar_url;

  const user = await User.findOneAndUpdate({ id: userId }, { $set }, { returnDocument: "after", runValidators: true }).lean();
  if (!user) throw HttpError.notFound("Profile not found");
  return toPublicUser(user);
};
