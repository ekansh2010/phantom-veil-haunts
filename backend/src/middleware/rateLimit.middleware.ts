import { RequestHandler } from "express";
import rateLimit, { Options } from "express-rate-limit";
import { env } from "../config/env.js";

const passthrough: RequestHandler = (_req, _res, next) => next();

const limiter = (options: Partial<Options>): RequestHandler =>
  env.RATE_LIMIT_ENABLED
    ? rateLimit({
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { error: "Too many requests. The veil needs rest — try again later." },
        ...options,
      })
    : passthrough;

/** Broad limit for every /api request. */
export const apiLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 600 });

/** Brute-force protection for credential endpoints (only failed attempts count). */
export const authLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true });

/** Password-reset requests. */
export const resetLimiter = limiter({ windowMs: 60 * 60 * 1000, limit: 5 });

/** Writes (watchlist toggles, profile updates, admin edits). */
export const writeLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 200 });
