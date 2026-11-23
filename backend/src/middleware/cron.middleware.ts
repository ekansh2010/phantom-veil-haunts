import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest();

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Compared in constant
 * time (hashed first so lengths match). Without CRON_SECRET nothing is accepted.
 */
export const requireCronSecret = (req: Request, _res: Response, next: NextFunction) => {
  const secret = env.CRON_SECRET?.trim();
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  const ok = Boolean(secret) && scheme?.toLowerCase() === "bearer" && Boolean(token) && crypto.timingSafeEqual(sha256(token!), sha256(secret!));
  if (!ok) return next(HttpError.unauthorized("Invalid or missing cron secret"));
  next();
};
