import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const booleanFromEnv = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? fallback : ["1", "true", "yes", "on"].includes(v.trim().toLowerCase())));

/** Placeholder used only in local development; refused in production. */
export const DEV_JWT_SECRET = "dev-only-insecure-phantom-veil-secret-change-me";
const KNOWN_WEAK_SECRETS = new Set([DEV_JWT_SECRET, "secret", "changeme", "change-me", "jwt_secret"]);
const MIN_PROD_SECRET_LENGTH = 32;

const nodeEnvOf = (source: NodeJS.ProcessEnv) => (source.NODE_ENV || "development") as "development" | "production" | "test";

const buildSchema = (nodeEnv: "development" | "production" | "test") =>
  z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/phantom_veil"),
    JWT_SECRET: z.string().min(1).default(DEV_JWT_SECRET),
    JWT_EXPIRES_IN: z.string().default("7d"),
    FRONTEND_URL: z.string().url().default("http://localhost:8080"),
    CORS_ORIGIN: z.string().optional(),
    ADMIN_USERNAME: z.string().min(3).max(30).default("VeilKeeper"),
    ADMIN_EMAIL: z.string().trim().toLowerCase().email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
    SEED_DEMO_DATA: booleanFromEnv(nodeEnv !== "production"),
    RATE_LIMIT_ENABLED: booleanFromEnv(nodeEnv !== "test"),
    EXTERNAL_CATALOG_ENABLED: booleanFromEnv(nodeEnv !== "test"),
    EXTERNAL_SYNC_TTL_HOURS: z.coerce.number().positive().default(24),
    TMDB_API_KEY: z.string().optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default(nodeEnv === "test" ? "silent" : "info"),
  });

export type Env = z.infer<ReturnType<typeof buildSchema>>;

/**
 * Parses and validates the environment. Fails fast in production when a
 * critical secret is missing, left at a placeholder, or too short.
 */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = buildSchema(nodeEnvOf(source)).safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;

  if (env.NODE_ENV === "production") {
    if (!source.MONGODB_URI) throw new Error("MONGODB_URI must be set in production");
    if (!source.JWT_SECRET || KNOWN_WEAK_SECRETS.has(env.JWT_SECRET) || env.JWT_SECRET.length < MIN_PROD_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must be a strong, unique value of at least ${MIN_PROD_SECRET_LENGTH} characters in production`);
    }
  }
  return env;
};

export const env: Env = loadEnv();

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
