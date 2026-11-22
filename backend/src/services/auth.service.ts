import bcrypt from "bcryptjs";
import { signToken } from "../middleware/auth.middleware.js";
import { User, WatchlistEntry } from "../models/index.js";
import { HttpError } from "../utils/httpError.js";
import { BCRYPT_ROUNDS, CASE_INSENSITIVE, escapeRegex, generateId, generateToken, hashToken } from "../utils/helpers.js";
import { sendPasswordResetEmail } from "./mail.service.js";
import { PublicUser, toPublicUser } from "./serializers.js";

const RESET_TTL_MS = 60 * 60 * 1000;

// Pre-computed hash used to equalise timing when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);

export interface AuthResult {
  token: string;
  user: PublicUser;
}

const findByEmail = (email: string) => User.findOne({ email }).collation(CASE_INSENSITIVE);

/** Turns `john.doe+x@mail.com` into an available username like `john.doe_x` or `john.doe_x2`. */
export const deriveUsername = async (email: string): Promise<string> => {
  const base = (email.split("@")[0] ?? "phantom").replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 24).padEnd(3, "_");
  // One query for every candidate sharing the prefix, instead of probing one by one.
  const taken = await User.find({ username: { $regex: `^${escapeRegex(base)}`, $options: "i" } }, { username: 1, _id: 0 }).lean();
  const takenSet = new Set(taken.map((u) => u.username.toLowerCase()));
  if (!takenSet.has(base.toLowerCase())) return base;
  for (let i = 2; i < 10_000; i++) {
    const candidate = `${base}${i}`;
    if (!takenSet.has(candidate.toLowerCase())) return candidate;
  }
  return `${base.slice(0, 18)}_${Date.now().toString(36)}`;
};

export const register = async (input: { email: string; password: string; username?: string }): Promise<AuthResult> => {
  if (await User.exists({ email: input.email }).collation(CASE_INSENSITIVE)) {
    throw HttpError.conflict("Email is already registered");
  }
  let username = input.username;
  if (username) {
    if (await User.exists({ username }).collation(CASE_INSENSITIVE)) throw HttpError.conflict("Username is already taken");
  } else {
    username = await deriveUsername(input.email);
  }

  const user = await User.create({
    id: generateId("u"),
    email: input.email,
    username,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    role: "user",
  });
  return { token: signToken(user), user: toPublicUser(user) };
};

export const login = async (email: string, password: string): Promise<AuthResult> => {
  const user = await findByEmail(email);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw HttpError.unauthorized("Invalid email or password");
  return { token: signToken(user), user: toPublicUser(user) };
};

export const getUser = async (id: string): Promise<PublicUser> => {
  const user = await User.findOne({ id }).lean();
  if (!user) throw HttpError.notFound("User not found");
  return toPublicUser(user);
};

/** Stateless JWTs can't be deleted, so logout bumps tokenVersion (revokes all of the user's sessions). */
export const logout = async (id: string): Promise<void> => {
  await User.updateOne({ id }, { $inc: { tokenVersion: 1 } });
};

export const changePassword = async (id: string, currentPassword: string, newPassword: string): Promise<AuthResult> => {
  const user = await User.findOne({ id });
  if (!user) throw HttpError.notFound("User not found");
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw HttpError.badRequest("Current password is incorrect");

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // other sessions are logged out
  await user.save();
  return { token: signToken(user), user: toPublicUser(user) };
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  const user = await findByEmail(email);
  if (!user) return; // identical response either way (no account enumeration)
  const token = generateToken();
  user.resetPasswordToken = hashToken(token);
  user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  await sendPasswordResetEmail(user.email, token);
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  const user = await User.findOne({ resetPasswordToken: hashToken(token), resetPasswordExpires: { $gt: new Date() } });
  if (!user) throw HttpError.badRequest("Reset link is invalid or has expired.");
  user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
};

/** Deletes a user and everything they own. */
export const deleteUserCascade = async (id: string): Promise<boolean> => {
  const { deletedCount } = await User.deleteOne({ id });
  if (deletedCount) await WatchlistEntry.deleteMany({ userId: id });
  return deletedCount > 0;
};
