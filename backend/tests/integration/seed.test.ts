import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env";
import { DEMO_PASSWORD, SEED_MOVIES } from "../../src/data/catalog";
import { seedDatabase } from "../../src/database/seed";
import { Movie, User, WatchlistEntry } from "../../src/models";
import { api } from "../helpers";

const original = { SEED_DEMO_DATA: env.SEED_DEMO_DATA, ADMIN_EMAIL: env.ADMIN_EMAIL, ADMIN_PASSWORD: env.ADMIN_PASSWORD };

afterEach(() => {
  Object.assign(env, original);
});

describe("seedDatabase", () => {
  it("does nothing destructive and seeds nothing with demo data off and no admin config", async () => {
    await seedDatabase();
    expect(await Movie.countDocuments()).toBe(0);
    expect(await User.countDocuments()).toBe(0);
  });

  it("creates the admin from ADMIN_EMAIL/ADMIN_PASSWORD (hashed) who can log in", async () => {
    Object.assign(env, { ADMIN_EMAIL: "admin@phantomveil.test", ADMIN_PASSWORD: "VeryStrong123" });
    await seedDatabase();
    const admin = await User.findOne({ email: "admin@phantomveil.test" }).lean();
    expect(admin?.role).toBe("admin");
    expect(await bcrypt.compare("VeryStrong123", admin!.passwordHash)).toBe(true);
    const login = await api().post("/api/auth/login").send({ email: "admin@phantomveil.test", password: "VeryStrong123" });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("admin");
  });

  it("never promotes an existing account that registered with the admin email", async () => {
    await api().post("/api/auth/register").send({ email: "admin@phantomveil.test", password: "Squatter123" });
    Object.assign(env, { ADMIN_EMAIL: "admin@phantomveil.test", ADMIN_PASSWORD: "VeryStrong123" });
    await seedDatabase();
    expect((await User.findOne({ email: "admin@phantomveil.test" }).lean())?.role).toBe("user");
  });

  it("seeds the catalog, demo users and watchlists when SEED_DEMO_DATA is on", async () => {
    env.SEED_DEMO_DATA = true;
    await seedDatabase();
    expect(await Movie.countDocuments()).toBe(SEED_MOVIES.length);
    const demo = await User.findOne({ username: "NightWatcher" }).lean();
    expect(demo).not.toBeNull();
    expect(await bcrypt.compare(DEMO_PASSWORD, demo!.passwordHash)).toBe(true);
    expect(await WatchlistEntry.countDocuments({ userId: demo!.id })).toBe(3);
    // Non-production fallback admin
    expect(await User.countDocuments({ role: "admin" })).toBe(1);
  });

  it("is idempotent and never overwrites existing data", async () => {
    env.SEED_DEMO_DATA = true;
    await seedDatabase();
    await Movie.updateOne({ id: "1" }, { title: "Edited by admin" });
    await Movie.deleteOne({ id: "2" });
    await seedDatabase();
    await seedDatabase();
    expect(await Movie.countDocuments()).toBe(SEED_MOVIES.length - 1);
    expect((await Movie.findOne({ id: "1" }).lean())?.title).toBe("Edited by admin");
    expect(await User.countDocuments({ username: "NightWatcher" })).toBe(1);
    expect(await User.countDocuments({ role: "admin" })).toBe(1);
  });
});
