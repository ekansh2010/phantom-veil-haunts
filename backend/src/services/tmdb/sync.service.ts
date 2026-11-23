import type { AnyBulkWriteOperation } from "mongoose";
import { env, isTmdbConfigured } from "../../config/env.js";
import { IMovie, Movie, SyncState } from "../../models/index.js";
import { logger } from "../../utils/logger.js";
import { createTmdbClient, TmdbClient, TmdbError } from "./client.js";
import { definedOnly, mapTmdbDetails, mapTmdbListItem, providerRegions, TmdbListFields } from "./mappers.js";
import { SUBGENRES } from "./subgenres.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- TMDB payloads are untyped JSON */

export type SyncMode = "daily" | "full";

/** One page of one TMDB list. The plan is a deterministic list of these, so a cursor can resume it. */
export interface PlanStep {
  list: string;
  page: number;
  params: Record<string, string>;
  /** Keyword names resolved to ids (OR-ed) when the step runs. */
  keywordNames?: string[];
  /** Sub-genre tags added to every title on the page. */
  tags: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const BASE_DISCOVER = { with_genres: "27", include_adult: "false", include_video: "false", language: "en-US" };

/** List definitions: [list, params, keyword names, tags, daily pages, full pages]. */
const listDefs = (today: Date) => {
  const day = (offset: number) => isoDate(new Date(today.getTime() + offset * DAY_MS));
  const defs: Array<{ list: string; params: Record<string, string>; keywordNames?: string[]; tags: string[]; daily: number; full: number }> = [
    { list: "popular", params: { sort_by: "popularity.desc" }, tags: [], daily: 5, full: 50 },
    { list: "top-rated", params: { sort_by: "vote_average.desc", "vote_count.gte": "500" }, tags: [], daily: 2, full: 10 },
    {
      list: "now-playing",
      params: { sort_by: "popularity.desc", "primary_release_date.gte": day(-60), "primary_release_date.lte": day(0), with_release_type: "2|3" },
      tags: [],
      daily: 2,
      full: 3,
    },
    { list: "upcoming", params: { sort_by: "popularity.desc", "primary_release_date.gte": day(1), "primary_release_date.lte": day(180) }, tags: [], daily: 2, full: 3 },
    { list: "classic", params: { sort_by: "vote_count.desc", "primary_release_date.lte": "1979-12-31" }, tags: [], daily: 1, full: 10 },
  ];
  for (const s of SUBGENRES) {
    if (s.withGenres) defs.push({ list: s.key, params: { sort_by: "popularity.desc", with_genres: s.withGenres }, tags: [s.key], daily: 1, full: 5 });
    else if (s.keywords) defs.push({ list: s.key, params: { sort_by: "popularity.desc" }, keywordNames: s.keywords, tags: [s.key], daily: 1, full: 5 });
  }
  return defs;
};

/**
 * Daily: the first pages of every list (~20 requests) so rows stay fresh.
 * Full: ~110 pages: ~1000 popular horror titles plus deep sub-collections.
 */
export const buildPlan = (mode: SyncMode, today: Date = new Date()): PlanStep[] =>
  listDefs(today).flatMap((d) =>
    Array.from({ length: mode === "daily" ? d.daily : d.full }, (_, i) => ({
      list: d.list,
      page: i + 1,
      params: { ...BASE_DISCOVER, ...d.params },
      ...(d.keywordNames ? { keywordNames: d.keywordNames } : {}),
      tags: d.tags,
    })),
  );

/** Upserts list results by tmdb id in ONE bulk write. Curated (seed/admin) titles are never overwritten. */
export const upsertTmdbMovies = async (items: Array<{ fields: TmdbListFields; tags: string[] }>): Promise<number> => {
  const unique = [...new Map(items.map((i) => [i.fields.id, i])).values()];
  if (!unique.length) return 0;
  const ops: AnyBulkWriteOperation<IMovie>[] = unique.map(({ fields, tags }) => ({
    updateOne: {
      filter: { id: fields.id, source: "tmdb" },
      update: { $set: definedOnly(fields), ...(tags.length ? { $addToSet: { subgenres: { $each: tags } } } : {}) },
      upsert: true,
    },
  }));
  try {
    await Movie.bulkWrite(ops, { ordered: false });
  } catch (err) {
    // Duplicate keys mean the id already belongs to a curated title; the other writes still applied.
    const e = err as { code?: number; writeErrors?: Array<{ code?: number }> };
    const onlyDuplicates = e.code === 11000 || (Array.isArray(e.writeErrors) && e.writeErrors.length > 0 && e.writeErrors.every((w) => w.code === 11000));
    if (!onlyDuplicates) throw err;
  }
  return unique.length;
};

/** Resolves TMDB keyword names to ids (exact name match preferred). Memoised per run. */
const resolveKeywords = async (client: TmdbClient, names: string[], cache: Map<string, number | null>): Promise<number[]> => {
  const ids: number[] = [];
  for (const name of names) {
    if (!cache.has(name)) {
      const data = await client.get<any>("/search/keyword", { query: name, page: 1 });
      const results: any[] = Array.isArray(data?.results) ? data.results : [];
      const hit = results.find((r) => String(r?.name).toLowerCase() === name.toLowerCase()) ?? results[0];
      cache.set(name, Number.isInteger(hit?.id) ? hit.id : null);
    }
    const id = cache.get(name);
    if (id) ids.push(id);
  }
  return ids;
};

/** Runs one plan step: fetch a discover page and upsert it. Returns titles upserted. */
export const runStep = async (client: TmdbClient, step: PlanStep, keywordCache: Map<string, number | null> = new Map()): Promise<number> => {
  const params: Record<string, string | number> = { ...step.params, page: step.page };
  if (step.keywordNames) {
    const ids = await resolveKeywords(client, step.keywordNames, keywordCache);
    if (!ids.length) return 0;
    params.with_keywords = ids.join("|");
  }
  const data = await client.get<any>("/discover/movie", params);
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const mapped = results
    .map((r) => mapTmdbListItem(r))
    .filter((m): m is TmdbListFields => m !== null && m.isHorror === true)
    .map((fields) => ({ fields, tags: step.tags }));
  return upsertTmdbMovies(mapped);
};

export interface SyncOptions {
  mode?: SyncMode;
  /** Stop starting new steps after this long (the cursor is saved; the next run resumes). */
  budgetMs?: number;
  maxSteps?: number;
  /** Restart the plan from the first page. */
  reset?: boolean;
  now?: () => Date;
  client?: TmdbClient | null;
}

export interface SyncResult {
  configured: boolean;
  mode: SyncMode;
  stepsRun: number;
  upserted: number;
  cursor: number;
  total: number;
  done: boolean;
  message: string;
  error?: string;
}

export const syncStateKey = (mode: SyncMode) => `tmdb-sync:${mode}`;
export const NOT_CONFIGURED_MESSAGE = "TMDB is not configured (set TMDB_READ_TOKEN or TMDB_API_KEY); using the bundled + TVmaze catalog.";

/**
 * Resumable, idempotent TMDB import. Each call runs plan steps until the time
 * budget is spent, saving the cursor after every step, so it fits in a
 * serverless function and survives being killed mid-way. A no-op without a key.
 */
export const runTmdbSync = async (options: SyncOptions = {}): Promise<SyncResult> => {
  const mode = options.mode ?? "daily";
  const now = options.now ?? (() => new Date());
  const client = options.client === undefined ? createTmdbClient() : options.client;
  if (!client || !isTmdbConfigured()) {
    return { configured: false, mode, stepsRun: 0, upserted: 0, cursor: 0, total: 0, done: false, message: NOT_CONFIGURED_MESSAGE };
  }

  const key = syncStateKey(mode);
  const started = Date.now();
  const budgetMs = options.budgetMs ?? Infinity;
  const maxSteps = options.maxSteps ?? Infinity;
  const plan = buildPlan(mode, now());

  const state = await SyncState.findOne({ key }).lean();
  let cursor = options.reset ? 0 : (state?.cursor ?? 0);
  let runCount = options.reset ? 0 : (state?.runCount ?? 0);
  if (cursor >= plan.length || cursor < 0) {
    cursor = 0;
    runCount = 0;
  }
  await SyncState.updateOne({ key }, { $set: { lastAttemptAt: now(), cursor, total: plan.length, runCount } }, { upsert: true });

  const keywordCache = new Map<string, number | null>();
  let stepsRun = 0;
  let upserted = 0;
  let error: string | undefined;

  while (cursor < plan.length && stepsRun < maxSteps && Date.now() - started < budgetMs) {
    try {
      const n = await runStep(client, plan[cursor], keywordCache);
      upserted += n;
      runCount += n;
      cursor += 1;
      stepsRun += 1;
      await SyncState.updateOne({ key }, { $set: { cursor, runCount }, $unset: { lastError: 1 } });
    } catch (err) {
      // Leave the cursor on the failed step so the next run retries it.
      error = err instanceof Error ? err.message : String(err);
      logger.warn(`TMDB sync (${mode}) stopped at step ${cursor + 1}/${plan.length}: ${error}`);
      await SyncState.updateOne({ key }, { $set: { lastError: error.slice(0, 500) } });
      if (err instanceof TmdbError && (err.status === 401 || err.status === 403)) logger.error("TMDB rejected the credentials; check TMDB_READ_TOKEN / TMDB_API_KEY");
      break;
    }
  }

  const done = !error && cursor >= plan.length;
  if (done) {
    await SyncState.updateOne({ key }, { $set: { lastSuccessAt: now(), itemCount: runCount, cursor: 0, runCount: 0 } });
    // A finished daily refresh also satisfies the on-request freshness check.
    if (mode === "daily") await SyncState.updateOne({ key: "external-catalog" }, { $set: { lastSuccessAt: now(), itemCount: runCount } }, { upsert: true });
  }

  const message = done
    ? `TMDB ${mode} sync complete: ${stepsRun} page(s) this run, ${runCount} title(s) in this pass.`
    : error
      ? `TMDB ${mode} sync paused by an error at step ${cursor + 1}/${plan.length}; it will resume from there.`
      : `TMDB ${mode} sync in progress: ${cursor}/${plan.length} pages; call again to continue.`;
  return { configured: true, mode, stepsRun, upserted, cursor: done ? 0 : cursor, total: plan.length, done, message, ...(error ? { error } : {}) };
};

// ---------------------------------------------------------------------------
// Lazy details and search
// ---------------------------------------------------------------------------

const DETAIL_APPEND = "videos,credits,release_dates,keywords,watch/providers";

/** Fetches full details for one TMDB id and stores them. Returns the stored movie, or null if TMDB has no such id. */
export const fetchAndStoreTmdbDetails = async (tmdbId: number, client: TmdbClient | null = createTmdbClient()): Promise<IMovie | null> => {
  if (!client) return null;
  const data = await client.getOrNull<any>(`/movie/${tmdbId}`, { append_to_response: DETAIL_APPEND, language: "en-US" });
  const mapped = data ? mapTmdbDetails(data, providerRegions(env.TMDB_REGION)) : null;
  if (!mapped || mapped.fields.tmdbId !== tmdbId) return null;
  const { fields, tags } = mapped;
  const update = {
    $set: { ...definedOnly(fields), providers: fields.providers ?? null },
    ...(tags.length ? { $addToSet: { subgenres: { $each: tags } } } : {}),
  };
  try {
    return await Movie.findOneAndUpdate({ id: fields.id, source: "tmdb" }, update, { upsert: true, returnDocument: "after" }).lean<IMovie>();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return Movie.findOne({ id: fields.id }).lean<IMovie>(); // curated title owns the id
    throw err;
  }
};

/** True when a stored TMDB title has no (or stale) videos/credits/providers yet. */
export const needsDetails = (movie: Pick<IMovie, "source" | "tmdbId" | "detailsFetchedAt">, now: Date = new Date()): boolean => {
  if (movie.source !== "tmdb" || !movie.tmdbId || !isTmdbConfigured()) return false;
  if (!movie.detailsFetchedAt) return true;
  return now.getTime() - new Date(movie.detailsFetchedAt).getTime() > env.TMDB_DETAILS_TTL_HOURS * 60 * 60 * 1000;
};

/** Returns the movie with fresh details, falling back to the stored copy if TMDB fails. */
export const ensureTmdbDetails = async (movie: IMovie): Promise<IMovie> => {
  if (!needsDetails(movie)) return movie;
  try {
    return (await fetchAndStoreTmdbDetails(movie.tmdbId!)) ?? movie;
  } catch (err) {
    logger.warn(`TMDB details for ${movie.id} unavailable; serving cached copy`, err);
    return movie;
  }
};

const SEARCH_TTL_MS = DAY_MS;

/**
 * Searches TMDB for horror titles matching `q` and stores them, at most once
 * per query per day (tracked in SyncState). Returns how many were stored.
 */
export const searchTmdbAndStore = async (q: string, now: Date = new Date(), client: TmdbClient | null = createTmdbClient()): Promise<number> => {
  if (!client) return 0;
  const normalized = q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 100);
  if (normalized.length < 2) return 0;
  const key = `tmdb-search:${normalized}`;
  const state = await SyncState.findOne({ key }).lean();
  if (state?.lastAttemptAt && now.getTime() - new Date(state.lastAttemptAt).getTime() < SEARCH_TTL_MS) return 0;
  await SyncState.updateOne({ key }, { $set: { lastAttemptAt: now } }, { upsert: true });

  const data = await client.get<any>("/search/movie", { query: normalized, include_adult: "false", language: "en-US", page: 1 });
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const horror = results
    .map((r) => mapTmdbListItem(r))
    .filter((m): m is TmdbListFields => m !== null && m.isHorror === true)
    .map((fields) => ({ fields, tags: [] as string[] }));
  const count = await upsertTmdbMovies(horror);
  await SyncState.updateOne({ key }, { $set: { lastSuccessAt: now, itemCount: count } });
  return count;
};

/** Sync progress for admin stats. */
export const getTmdbSyncStatus = async () => {
  const [daily, full, tmdbMovies] = await Promise.all([
    SyncState.findOne({ key: syncStateKey("daily") }).lean(),
    SyncState.findOne({ key: syncStateKey("full") }).lean(),
    Movie.countDocuments({ source: "tmdb" }),
  ]);
  const view = (s: typeof daily) =>
    s ? { lastSuccessAt: s.lastSuccessAt ?? null, lastAttemptAt: s.lastAttemptAt ?? null, cursor: s.cursor ?? 0, total: s.total ?? null, lastError: s.lastError ?? null } : null;
  return { configured: isTmdbConfigured(), tmdbMovies, daily: view(daily), full: view(full) };
};
