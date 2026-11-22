import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { DEMO_PASSWORD, DEMO_USERS, SEED_MOVIES } from "../data/catalog.js";
import { Movie, User, WatchlistEntry } from "../models/index.js";
import { BCRYPT_ROUNDS, CASE_INSENSITIVE, generateId } from "../utils/helpers.js";
import { logger } from "../utils/logger.js";

const DEV_ADMIN_EMAIL = "admin@phantomveil.local";

/**
 * Idempotent, NON-destructive seeding. Existing data is never modified or deleted.
 *
 * - Admin: created from ADMIN_EMAIL/ADMIN_PASSWORD when no admin exists. With demo
 *   seeding on (non-production default) a local demo admin is used as a fallback.
 * - Catalog + demo users/watchlists: only when SEED_DEMO_DATA is on AND the movie
 *   collection is empty (so admin edits/deletions are respected afterwards).
 */
export const seedDatabase = async (): Promise<void> => {
  try {
    await seedAdmin();

    if (env.SEED_DEMO_DATA && (await Movie.estimatedDocumentCount()) === 0) {
      logger.info("Seeding catalog and demo users...");
      await Movie.insertMany(SEED_MOVIES, { ordered: false }).catch(() => undefined);

      const demoHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
      for (const demo of DEMO_USERS) {
        const exists = await User.exists({ $or: [{ id: demo.id }, { email: demo.email }, { username: demo.username }] }).collation(CASE_INSENSITIVE);
        if (exists) continue;
        await User.create({ id: demo.id, email: demo.email, username: demo.username, favoriteGenre: demo.favoriteGenre, passwordHash: demoHash, role: "user" });
        await WatchlistEntry.insertMany(
          demo.watchlist.map((movieId) => ({ userId: demo.id, movieId })),
          { ordered: false },
        ).catch(() => undefined);
      }
    }
  } catch (error) {
    // Seeding must never take the API down.
    logger.error("Database seeding failed", error);
  }
};

const seedAdmin = async () => {
  if (await User.exists({ role: "admin" })) return;

  const email = env.ADMIN_EMAIL ?? (env.SEED_DEMO_DATA && env.NODE_ENV !== "production" ? DEV_ADMIN_EMAIL : undefined);
  const password = env.ADMIN_PASSWORD ?? (env.SEED_DEMO_DATA && env.NODE_ENV !== "production" ? DEMO_PASSWORD : undefined);
  if (!email || !password) {
    logger.warn("No admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD to create one.");
    return;
  }

  // Never auto-promote an existing account: whoever registered that email first
  // would silently become admin.
  if (await User.exists({ email }).collation(CASE_INSENSITIVE)) {
    logger.warn("ADMIN_EMAIL already belongs to a non-admin account; admin was not seeded.");
    return;
  }

  const usernameTaken = await User.exists({ username: env.ADMIN_USERNAME }).collation(CASE_INSENSITIVE);
  await User.create({
    id: generateId("u"),
    email,
    username: usernameTaken ? `${env.ADMIN_USERNAME}_${Date.now().toString(36)}`.slice(0, 30) : env.ADMIN_USERNAME,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role: "admin",
  });
  logger.info("Seeded admin account");
};
