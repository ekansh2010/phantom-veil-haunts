import compression from "compression";
import cors, { CorsOptions } from "cors";
import express, { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import helmet from "helmet";
import path from "path";
import { env, isProd, isTest, isTmdbConfigured } from "./config/env.js";
import { connectDb, isDbConnected, waitForDb } from "./database/connection.js";
import { apiNotFound, errorHandler } from "./middleware/error.middleware.js";
import { apiLimiter } from "./middleware/rateLimit.middleware.js";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import cronRoutes from "./routes/cron.routes.js";
import movieRoutes from "./routes/movie.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import watchlistRoutes from "./routes/watchlist.routes.js";
import { HttpError } from "./utils/httpError.js";
import { logger } from "./utils/logger.js";

export interface AppOptions {
  /** Directory of the built frontend to serve (SPA). null disables static hosting. */
  staticDir?: string | null;
  /** Ensure a DB connection before each API request (serverless-friendly). */
  autoConnect?: boolean;
}

export const buildCorsOptions = (): CorsOptions => {
  if (env.CORS_ORIGIN) {
    const allowed = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
    return { origin: allowed.includes("*") ? true : allowed };
  }
  // Production default: same-origin only (frontend and API share a domain on Vercel).
  return { origin: !isProd };
};

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(`${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
};

export const createApp = (options: AppOptions = {}): Express => {
  const { staticDir = null, autoConnect = true } = options;
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY); // real client IPs behind Vercel/Render for rate limiting

  app.use(
    helmet({
      // The SPA loads remote posters, trailers and fonts; CSP is left to the hosting layer.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cors(buildCorsOptions()));
  app.use(compression());
  if (!isTest) app.use(requestLogger);
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  // Health: connects first on a cold instance so it reports real DB reachability.
  const health = async (_req: Request, res: Response) => {
    const db = autoConnect ? await waitForDb() : isDbConnected();
    res.status(db ? 200 : 503).json({
      status: db ? "alive in the veil" : "degraded",
      db: db ? "connected" : "disconnected",
      tmdb: isTmdbConfigured() ? "configured" : "not configured",
      catalog: isTmdbConfigured() ? "tmdb" : "bundled+tvmaze",
      time: new Date().toISOString(),
    });
  };
  app.get("/health", health);
  app.get("/api/health", health);

  app.use("/api", apiLimiter);
  if (autoConnect) {
    app.use("/api", async (_req, _res, next) => {
      try {
        await connectDb();
        next();
      } catch (err) {
        logger.error("Database unavailable", err);
        next(HttpError.unavailable());
      }
    });
  }

  app.use("/api/auth", authRoutes);
  app.use("/api/movies", movieRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/watchlist", watchlistRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/cron", cronRoutes);
  app.use("/api", apiNotFound);

  // Optional SPA hosting for single-server deployments (Render/Railway/Docker).
  if (staticDir && fs.existsSync(path.join(staticDir, "index.html"))) {
    app.use(express.static(staticDir, { index: false, maxAge: isProd ? "1h" : 0 }));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(staticDir, "index.html")));
  }

  app.use(errorHandler);
  return app;
};
