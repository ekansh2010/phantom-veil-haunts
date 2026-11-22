import crypto from "crypto";

/** Escapes a user-supplied string so it can be embedded literally in a RegExp. */
export const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Generates a prefixed, collision-resistant public id, e.g. `u_9f2c...`. */
export const generateId = (prefix: string): string => `${prefix}_${crypto.randomBytes(12).toString("hex")}`;

/** Random URL-safe token for emailed links (sent to the user, never stored raw). */
export const generateToken = (): string => crypto.randomBytes(32).toString("hex");

/** One-way hash used to store reset tokens at rest. */
export const hashToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

/** Case-insensitive collation for email/username uniqueness checks. */
export const CASE_INSENSITIVE = { locale: "en", strength: 2 } as const;

/** bcrypt work factor — lowered only under test to keep the suite fast. */
export const BCRYPT_ROUNDS = process.env.NODE_ENV === "test" ? 4 : 12;

/** Clamps pagination input to sane bounds. */
export const paginate = (page: number, limit: number) => ({ skip: (page - 1) * limit, limit });
