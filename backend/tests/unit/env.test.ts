import { describe, expect, it } from "vitest";
import { DEV_JWT_SECRET, loadEnv } from "../../src/config/env";

const STRONG = "a".repeat(48);

describe("loadEnv", () => {
  it("applies development defaults", () => {
    const env = loadEnv({ NODE_ENV: "development" });
    expect(env.PORT).toBe(5000);
    expect(env.JWT_SECRET).toBe(DEV_JWT_SECRET);
    expect(env.SEED_DEMO_DATA).toBe(true);
    expect(env.RATE_LIMIT_ENABLED).toBe(true);
    expect(env.EXTERNAL_CATALOG_ENABLED).toBe(true);
  });

  it("defaults demo seeding OFF in production and parses booleans", () => {
    const base = { NODE_ENV: "production", MONGODB_URI: "mongodb://x/db", JWT_SECRET: STRONG };
    expect(loadEnv(base).SEED_DEMO_DATA).toBe(false);
    expect(loadEnv({ ...base, SEED_DEMO_DATA: "true" }).SEED_DEMO_DATA).toBe(true);
    expect(loadEnv({ ...base, SEED_DEMO_DATA: "0" }).SEED_DEMO_DATA).toBe(false);
  });

  it("disables rate limiting and the external catalog under test by default", () => {
    const env = loadEnv({ NODE_ENV: "test" });
    expect(env.RATE_LIMIT_ENABLED).toBe(false);
    expect(env.EXTERNAL_CATALOG_ENABLED).toBe(false);
    expect(env.LOG_LEVEL).toBe("silent");
  });

  it("fails fast in production without MONGODB_URI", () => {
    expect(() => loadEnv({ NODE_ENV: "production", JWT_SECRET: STRONG })).toThrow(/MONGODB_URI/);
  });

  it.each([undefined, DEV_JWT_SECRET, "secret", "short-but-not-32-chars"])("fails fast in production with a weak JWT_SECRET (%s)", (secret) => {
    expect(() => loadEnv({ NODE_ENV: "production", MONGODB_URI: "mongodb://x/db", ...(secret ? { JWT_SECRET: secret } : {}) })).toThrow(/JWT_SECRET/);
  });

  it("rejects invalid values", () => {
    expect(() => loadEnv({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadEnv({ ADMIN_EMAIL: "nope" })).toThrow(/ADMIN_EMAIL/);
    expect(() => loadEnv({ ADMIN_PASSWORD: "short" })).toThrow(/ADMIN_PASSWORD/);
    expect(() => loadEnv({ FRONTEND_URL: "not a url" })).toThrow(/FRONTEND_URL/);
  });
});
