import { Request, Response } from "express";
import { isTmdbConfigured } from "../config/env.js";
import { NOT_CONFIGURED_MESSAGE, runTmdbSync } from "../services/tmdb/sync.service.js";

/** Total time the cron run may spend (function maxDuration is 60 s). */
export const CRON_BUDGET_MS = 40_000;

/**
 * Daily refresh: first pages of every TMDB list, then the remaining budget
 * continues the deep (resumable) import from where it last stopped.
 */
export const sync = async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  if (!isTmdbConfigured()) {
    res.json({ ok: true, skipped: true, message: NOT_CONFIGURED_MESSAGE });
    return;
  }
  const started = Date.now();
  const daily = await runTmdbSync({ mode: "daily", budgetMs: CRON_BUDGET_MS });
  const remaining = CRON_BUDGET_MS - (Date.now() - started);
  const full = daily.done && remaining > 5_000 ? await runTmdbSync({ mode: "full", budgetMs: remaining }) : null;
  res.json({ ok: !daily.error, skipped: false, daily, full });
};
