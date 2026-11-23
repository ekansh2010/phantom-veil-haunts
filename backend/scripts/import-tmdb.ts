/**
 * One-off / manual TMDB import into MongoDB.
 *
 *   npm run import:tmdb                    # full import (~1000 horror titles), resumes where it stopped
 *   npm run import:tmdb -- --mode=daily    # just the first pages of every list
 *   npm run import:tmdb -- --reset         # restart the plan from page 1
 *   npm run import:tmdb -- --max-pages=10  # stop after 10 pages
 *
 * Reads MONGODB_URI and TMDB_READ_TOKEN (or TMDB_API_KEY) from the environment / .env.
 * Connects with plain mongoose (no seeding), so it is safe against the production DB.
 */
import dns from "dns";
import mongoose from "mongoose";
import { pathToFileURL } from "url";
import { env, isTmdbConfigured } from "../src/config/env.js";
import { Movie } from "../src/models/index.js";
import { runTmdbSync, SyncMode, SyncResult } from "../src/services/tmdb/sync.service.js";

export interface ImportArgs {
  mode: SyncMode;
  reset: boolean;
  maxPages?: number;
  dnsOverride: boolean;
}

export const parseImportArgs = (argv: string[]): ImportArgs => {
  const args: ImportArgs = { mode: "full", reset: false, dnsOverride: true };
  for (const a of argv) {
    if (a === "--reset") args.reset = true;
    else if (a === "--no-dns-override") args.dnsOverride = false;
    else if (a.startsWith("--mode=")) {
      const m = a.slice(7);
      if (m !== "daily" && m !== "full") throw new Error(`Unknown --mode "${m}" (use daily or full)`);
      args.mode = m;
    } else if (a.startsWith("--max-pages=")) {
      const n = Number(a.slice(12));
      if (!Number.isInteger(n) || n < 1) throw new Error("--max-pages must be a positive integer");
      args.maxPages = n;
    } else throw new Error(`Unknown argument "${a}"`);
  }
  return args;
};

/** Runs the resumable sync to completion (or until maxPages). Assumes mongoose is connected. */
export const runImport = async (args: ImportArgs, log: (msg: string) => void = console.log): Promise<SyncResult> => {
  let pagesLeft = args.maxPages ?? Infinity;
  let reset = args.reset;
  let last: SyncResult;
  do {
    last = await runTmdbSync({ mode: args.mode, reset, maxSteps: Math.min(10, pagesLeft) });
    reset = false;
    pagesLeft -= last.stepsRun;
    log(`[import:tmdb] ${last.message}`);
    if (!last.configured || last.error || last.stepsRun === 0) break;
  } while (!last.done && pagesLeft > 0);
  return last;
};

const main = async () => {
  const args = parseImportArgs(process.argv.slice(2));
  if (!isTmdbConfigured()) {
    console.error("[import:tmdb] Set TMDB_READ_TOKEN (or TMDB_API_KEY) in .env or the environment first.");
    process.exit(1);
  }
  // SRV lookups for mongodb+srv:// fail with some local resolvers; use public DNS.
  if (args.dnsOverride) dns.setServers(["8.8.8.8", "1.1.1.1"]);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
  try {
    await Movie.createIndexes(); // ensures the tmdbId/subgenre indexes (never drops any)
    const result = await runImport(args);
    console.log(`[import:tmdb] TMDB titles stored: ${await Movie.countDocuments({ source: "tmdb" })}`);
    if (result.error) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("[import:tmdb] failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
