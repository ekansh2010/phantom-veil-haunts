# 🎭 Phantom Veil

<div align="center">

### Explore Horror Movies & Shows

A cinematic horror entertainment platform with immersive visuals.

</div>

---

Phantom Veil is a horror movie hub: browse curated and live horror titles, watch atmospheric trailers, search the catalog, keep a personal watchlist and profile. React + Vite frontend, Express + MongoDB backend, deployed on Vercel.

**Live:** https://phantom-veil-omega.vercel.app
**Health:** https://phantom-veil-omega.vercel.app/api/health

---

## Features

- **Horror movie library (TMDB)**: once a TMDB credential is set, TMDB is the primary source. About 1000 popular horror movies plus top-rated, now playing, upcoming, classic (pre-1980) and sub-genre collections (Supernatural, Psychological, Slasher, Zombie, Haunted House) are imported into MongoDB (upsert by `tmdbId`, idempotent) and refreshed daily by a Vercel Cron job. See [Enable TMDB](#enable-tmdb).
- **Fallback catalog**: without a TMDB credential the app works exactly as before: the bundled titles plus horror shows synced from TVmaze at most once per 24 h. If an upstream API fails, the stored catalog is still served.
- **Rows**: Trending, New Nightmares, Top Rated, the sub-genres, Classic and Coming Soon (TMDB mode), each with a "See all" link into Browse.
- **Browse**: `/browse` with sub-genre, decade, minimum rating and sort filters, and infinite scroll. Works for both data sources.
- **Movie detail**: backdrop, tagline, runtime, certification, rating and vote count, genres, director, cast with photos, YouTube trailer, and "Where to watch" providers (region `TMDB_REGION`, default IN, then US) with TMDB/JustWatch attribution. Videos, credits and providers are fetched lazily on the first view and cached for `TMDB_DETAILS_TTL_HOURS`. Unknown `tv-*` / `tmdb-*` ids are fetched on demand, so deep links work.
- **Search**: by title, original title, description, genre, cast or director, with pagination. With TMDB enabled, queries with few local hits also ask TMDB `/search/movie` (horror results only, stored; each query at most once a day). User input is regex-escaped.
- **Accounts**: register, login, logout (revokes tokens), change password, forgot/reset password (hashed, single-use, 1 h tokens).
- **Profile**: username, favourite genre, avatar URL.
- **Watchlist**: toggle, idempotent add, remove. Returns movie details from one `$in` query.
- **Admin**: catalog CRUD, stats (most-watchlisted titles), user search, role changes, user deletion (cascades to the watchlist).

## Architecture

```
frontend/  React 18 + Vite + Tailwind + shadcn/ui (SPA)
api/index.ts            Vercel serverless entry -> createApp()
backend/index.ts        Local/Render server -> createApp() + serves frontend/dist
backend/src/
  app.ts                createApp() factory (helmet, CORS, compression, limits, health, routes, errors)
  config/env.ts         Zod-validated env; fails fast in production on missing/weak secrets
  database/             cached serverless-safe connection + idempotent non-destructive seeding
  routes/               URL -> middleware chain -> controller
  middleware/           auth (JWT + DB reload), validate (Zod), rateLimit, error handler
  controllers/          thin HTTP adapters
  services/             business logic (auth, movies, external catalog, watchlist, profile, admin)
  services/tmdb/        TMDB client (rate limit, retries), mappers, sub-genres, resumable sync/import
backend/scripts/        import-tmdb.ts (npm run import:tmdb)
  models/               Mongoose schemas (User, Movie, WatchlistEntry, SyncState)
  validation/schemas.ts Zod schemas for every body/params/query
backend/tests/          vitest + supertest + mongodb-memory-server
```

Requests go **routes -> middleware -> controllers -> services -> models**. One `createApp()` is shared by the local server, the Vercel function and the tests. Every error is returned as `{ "error": string, "details"?: [...] }` with the right status code (400/401/403/404/409/413/429/500/503).

### Why MongoDB instead of Supabase

The original code called a Supabase project (`eilxwnpwnwtrqwbppmvr.supabase.co`) that **no longer exists**: its DNS returns NXDOMAIN, so every auth, profile and watchlist call failed. The backend was migrated to MongoDB Atlas with Mongoose. All data access now goes through the Express API, with validation and authorization on the server. The obsolete `supabase/` migration folder and the generated Supabase client were removed. The old schema (profiles, watchlist) maps onto the `users` and `watchlist` collections.

---

## Checklist

### Understanding and fixes
- [x] Audited the frontend, backend, build scripts and Supabase schema
- [x] Found that the Supabase backend was dead (NXDOMAIN) and migrated to MongoDB/Mongoose
- [x] Rebuilt the backend in layers (routes / middleware / controllers / services / models) with a `createApp()` factory
- [x] Fixed movie id collisions: TVmaze show `1` overwrote seeded movie `1`. External ids are now namespaced (`tv-*`, `tmdb-*`)
- [x] Fixed the Profile watchlist, which only showed the 8 bundled titles: the API now returns each entry with its movie resolved
- [x] Fixed the broken password reset (it relied on Supabase recovery hashes) with a backend token flow (`/reset-password?token=...`)
- [x] Fixed "forgot password", which only did `console.log`: it now calls `/api/auth/forgot-password`
- [x] Fixed register: the UI said "check your email", but no email existed. It now signs the user in. Password rules match the backend
- [x] Fixed the in-memory movie cache, which was lost on every serverless cold start: it is now persisted in MongoDB (`SyncState` + upserts)
- [x] Fixed audio files referenced as `/src/assets/...`, which broke in production builds: they are now imported so Vite bundles them
- [x] Replaced the custom esbuild scripts and the stale `dist/`, `backend-dist/` and `bun.lockb` with a standard Vite build
- [x] Fixed the Tailwind/PostCSS config path so CSS builds from any working directory
- [x] Fixed lint errors properly: removed unused code and re-enabled `no-unused-vars` in place of the blanket `off`
- [x] `/api/*` unknown routes now return JSON 404 instead of the SPA HTML
- [x] Fixed the single-server SPA fallback: Express 5's `*` wildcard didn't match `/`, so it now uses `/{*splat}`

### Security
- [x] `.env` is no longer tracked by git; `.env.example` has placeholders only
- [x] bcrypt password hashing (12 rounds), with a constant-time-ish login (a dummy hash for unknown emails)
- [x] JWT (HS256 pinned, `alg:none` rejected). Each request reloads the user from the DB, so the role comes from the DB, never the token
- [x] `tokenVersion` revocation on logout, password change/reset, role change and user deletion
- [x] Reset tokens are stored as SHA-256 hashes, are single-use, expire in 1 h, and use the same response for known and unknown emails (no enumeration)
- [x] Zod validation on every body, params and query. Unknown keys are stripped (no `role` injection), and object payloads are rejected (no NoSQL operator injection)
- [x] User input is regex-escaped in search (no ReDoS or wildcard abuse)
- [x] URLs are restricted to http(s) or site paths (blocks `javascript:` and `data:`)
- [x] helmet headers, `x-powered-by` off, 100 kb body limits, configurable CORS (same-origin only in production by default)
- [x] Rate limits: global API, auth brute-force, reset requests, writes (disabled in tests)
- [x] Env validation fails fast in production without `MONGODB_URI` or with a weak/short `JWT_SECRET`
- [x] The admin seed never promotes an existing account that registered with `ADMIN_EMAIL`
- [x] Admins cannot demote or delete themselves
- [x] No secrets in code. Production secrets live only in Vercel env vars

### Backend principles
- [x] Serverless-safe cached MongoDB connection (connect and seed run once per instance; a failure resets so the next request retries)
- [x] `/api/health` connects first, then reports DB status (200 connected / 503 degraded)
- [x] Idempotent, non-destructive seeding (catalog and demo users only into an empty collection; `SEED_DEMO_DATA`)
- [x] No N+1 queries (watchlist and admin stats use a single `$in`; external sync uses one `bulkWrite`)
- [x] Indexes: unique ids and emails, case-insensitive unique usernames, unique `(userId, movieId)`, sort indexes
- [x] Atomic idempotent watchlist add (upsert), so concurrent requests never duplicate entries
- [x] Graceful shutdown and request logging (local server)

### Tests and tooling
- [x] Backend integration tests for every endpoint, covering happy paths, validation, 401/403/404/409/413 and edge cases
- [x] Backend unit tests (env, helpers, serializers, validation, external API mappers)
- [x] Frontend tests (auth provider, API helpers, reset-password page)
- [x] `typecheck`, `lint`, `test`, `build`, `start` and `dev` scripts all pass

### Deployment
- [x] `vercel.json` (Vite output, `api/index.ts` function, API and SPA rewrites)
- [x] All runtime imports use explicit `.js` extensions (native Node ESM on Vercel), verified with a compiled ESM import check
- [x] Production env vars set on Vercel; production deploy is live and passed a 22-check smoke test
- [x] `render.yaml` and `Procfile` updated for single-server hosting

### TMDB horror library
- [x] TMDB v3 client: `TMDB_READ_TOKEN` (Bearer) or `TMDB_API_KEY` (`api_key`), 8 s timeout, retries with backoff on 429 (honours `Retry-After`), 5xx and network errors, shared limiter (~35 requests / 10 s)
- [x] Mappers to the extended Movie model (tmdbId, original title, tagline, poster `w500` / backdrop `original` URLs, release date, runtime, genres, votes, popularity, certification, language, YouTube trailer, cast, director, keywords, watch providers)
- [x] Resumable, idempotent import plan (cursor saved after every page in `SyncState`) so it fits in a serverless function; daily cron + admin endpoint + local script
- [x] Lazy detail fetch (one request with `append_to_response`), cached with a freshness timestamp; TMDB failures fall back to the stored copy
- [x] No-key mode unchanged; health, meta and admin stats report whether TMDB is configured
- [x] Bundled titles and existing watchlist entries keep resolving in TMDB mode (rows/browse just switch to TMDB titles)
- [x] Footer attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB."

### Open follow-ups
- [ ] Wire a real email provider (SMTP/Resend) for password-reset emails. Production currently doesn't send the link; development logs it
- [ ] Admin UI in the frontend (the admin API is complete)
- [ ] Move JWT storage from `localStorage` to an httpOnly cookie to reduce XSS exposure
- [ ] Code-split the 500 kB frontend bundle
- [ ] Add a shared rate-limit store (e.g. Upstash Redis): limits are per serverless instance today
- [ ] Add Playwright end-to-end tests for the UI

---

## Tests

| Suite | Files | Tests |
|---|---|---|
| Backend integration (`backend/tests/integration`): app, auth, movies, watchlist, profile, admin, seed, external catalog, TMDB library, cron/admin sync | 10 | 113 |
| Backend unit (`backend/tests/unit`): env, helpers/serializers, validation, TVmaze mappers, TMDB mappers/plan, TMDB client/limiter | 6 | 45 |
| Frontend (`frontend/src/test`): useAuth, api helpers, ResetPassword, movies (helpers, attribution, Browse), example | 5 | 21 |
| **Total** | **21** | **179** |

TMDB tests use fixture JSON (`backend/tests/fixtures/tmdb`) and a mocked `fetch`; no key or network is needed.

```bash
npm test               # backend + frontend
npm run test:backend   # vitest + supertest + in-memory MongoDB (no external services needed)
npm run test:frontend
npm run typecheck      # backend + frontend + vite config
npm run lint           # 0 errors, 0 warnings
npm run build          # Vite -> frontend/dist
```

## Local setup

Requires Node 20+ and MongoDB (local `mongod`, Docker `mongo:7`, or an Atlas URI).

```bash
npm install
cp .env.example .env          # set MONGODB_URI (and JWT_SECRET for anything non-local)
npm run dev                   # API on :5000 (nodemon + tsx), web on :8080 (Vite, proxies /api)
```

In development, with `SEED_DEMO_DATA` defaulting to true, an empty database gets the 8-title catalog, two demo users (`nightwatcher@phantomveil.app` / `Phantom123`) and a local admin (`admin@phantomveil.local` / `Phantom123`), unless `ADMIN_EMAIL`/`ADMIN_PASSWORD` are set. **Do not point a development server at the production database**, because the dev fallback admin would be created there.

Single-server mode: `npm run build && npm start` serves the API and the built SPA on `PORT`.

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `production` enables strict checks |
| `PORT` | no | `5000` | Local/Render server port |
| `MONGODB_URI` | **prod** | `mongodb://127.0.0.1:27017/phantom_veil` | MongoDB connection string |
| `JWT_SECRET` | **prod** | dev placeholder | at least 32 chars in production |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime |
| `FRONTEND_URL` | no | `http://localhost:8080` | Base URL for reset links |
| `CORS_ORIGIN` | no | same-origin (prod) / any (dev) | Comma-separated allowed origins, or `*` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | recommended | none | Seeds the first admin if none exists |
| `ADMIN_USERNAME` | no | `VeilKeeper` | Seeded admin username |
| `SEED_DEMO_DATA` | no | true (dev) / false (prod) | Seed catalog and demo users into an empty DB |
| `EXTERNAL_CATALOG_ENABLED` | no | true (false in tests) | TVmaze/TMDB sync |
| `EXTERNAL_SYNC_TTL_HOURS` | no | `24` | Sync interval |
| `TMDB_READ_TOKEN` | no | none | TMDB API Read Access Token (preferred). Makes TMDB the primary source |
| `TMDB_API_KEY` | no | none | TMDB v3 API key (alternative to the read token) |
| `TMDB_REGION` | no | `IN` | Watch-provider region (US is the fallback) |
| `TMDB_DETAILS_TTL_HOURS` | no | `168` | How long cached videos/credits/providers stay fresh |
| `CRON_SECRET` | prod | none | Protects `GET /api/cron/sync` (Vercel Cron sends it as a Bearer token) |
| `RATE_LIMIT_ENABLED` | no | true (false in tests) | Rate limiting |
| `TRUST_PROXY` | no | `1` | Proxy hops (correct client IPs) |
| `LOG_LEVEL` | no | `info` | `debug` / `info` / `warn` / `error` / `silent` |

## Deployment

### Vercel (current)

The project `phantom-veil` is live at https://phantom-veil-omega.vercel.app.

```bash
npx vercel link --yes --project phantom-veil
npx vercel env add MONGODB_URI production   # also JWT_SECRET, FRONTEND_URL, ADMIN_EMAIL, ADMIN_PASSWORD, SEED_DEMO_DATA
npx vercel deploy --prod
```

`vercel.json` builds the SPA (`frontend/dist`, served by the CDN) and runs `api/index.ts` as one Node function for `/api/*`. Every other path falls back to `index.html`. The runtime is native ESM, so backend imports must keep their `.js` extensions. With the Git integration connected, pushes to `main` deploy automatically.

Atlas must allow connections from Vercel (Network Access `0.0.0.0/0`, or Vercel's egress IPs).

### Enable TMDB

The app runs without TMDB. To turn it into the full horror movie library:

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/signup), then go to **Settings → API** and request an API key (choose "Developer", fill in the short form).
2. On the same page, copy the **API Read Access Token** (the long token, not the short "API Key").
3. In this project folder, add it to Vercel production and paste the token when prompted:
   ```bash
   npx vercel env add TMDB_READ_TOKEN production
   ```
4. Redeploy so the function picks it up: `npx vercel deploy --prod` (or push a commit to `main`).
5. Fill the library (about 1000 titles), either:
   - **Locally (fastest)**: put `TMDB_READ_TOKEN=...` and the production `MONGODB_URI=...` in your local `.env`, then run
     ```bash
     npm run import:tmdb                  # full import; resumes if interrupted
     npm run import:tmdb -- --mode=daily  # just the first pages of every list
     npm run import:tmdb -- --reset       # start over from page 1
     ```
     The script connects with plain mongoose (no seeding), forces public DNS (8.8.8.8 / 1.1.1.1) for `mongodb+srv` lookups, and only upserts TMDB titles.
   - **Or from the API**: as an admin, call `POST /api/admin/sync/tmdb` with `{"mode":"full"}` repeatedly until the response says `"done": true` (each call works for about 25 s and saves its position).
6. Check it: `/api/health` shows `"tmdb":"configured"`, `/api/movies/meta` shows `"source":"tmdb"`, and the home page shows TMDB rows.

After that, the daily cron (`vercel.json` → `GET /api/cron/sync` at 03:30 UTC) refreshes the first pages of every list and then continues the deep import from where it stopped. It needs `CRON_SECRET` set in Vercel (already set for production). Without a TMDB credential the cron and the admin sync return 200 with a "not configured" message and do nothing.

TMDB terms: the footer shows the required notice, and "Where to watch" credits TMDB and JustWatch. There is no CSP; if you add one, allow `image.tmdb.org` (images) and `www.youtube-nocookie.com` (trailers).

### Render / Railway / Docker

`render.yaml` and `Procfile` run `npm run build` and then `npm start` (`tsx backend/index.ts`), which serves the API and the SPA from one process. Set the same env vars.

---

## API reference

All responses are JSON. Errors look like `{ "error": "message", "details"?: [{ "path", "message" }] }`. Authenticated routes need `Authorization: Bearer <token>`.

### Health
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | none | `200 {status, db:"connected", tmdb:"configured" or "not configured", catalog}` or `503` |

### Cron
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/cron/sync` | `Authorization: Bearer <CRON_SECRET>` | 401 without the secret. No TMDB key: `200 {skipped:true}`. Otherwise runs the daily refresh, then continues the full import (40 s budget) |

### Auth (`/api/auth`)
| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/register` | none | `{email, password, username?}` | `201 {token, user, session}` (409 duplicate) |
| POST | `/login` | none | `{email, password}` | `200 {token, user, session}` (401 invalid) |
| GET | `/me` | user | none | `{user}` |
| POST | `/logout` | user | none | Revokes all of the user's tokens |
| POST | `/change-password` | user | `{currentPassword, newPassword}` | New `{token, user}`; old tokens revoked |
| POST | `/forgot-password` | none | `{email}` | Always `200` (no enumeration) |
| POST | `/reset-password` | none | `{token, password}` | `200`, or `400` if invalid/expired/used |

Passwords: 8 to 128 chars, with at least one letter and one digit.

### Movies (`/api/movies`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | none | `[{title, movies: Movie[]}]` category rows |
| GET | `/search?q=&genre=&page=&limit=` | none | `{items, total, page, limit, totalPages}` (limit at most 50). Falls back to TMDB search when configured |
| GET | `/browse?subgenre=&decade=&yearFrom=&yearTo=&minRating=&sort=&page=&limit=` | none | Paginated, plus `source` (`tmdb` or `fallback`). `subgenre`: supernatural, psychological, slasher, zombie, haunted-house, classic. `sort`: popularity, rating, newest, oldest, title |
| GET | `/meta` | none | `{source, tmdbConfigured, subgenres[], sorts[]}` |
| GET | `/:id` | none | `Movie` with detail fields (fetches `tv-*`/`tmdb-*` on demand; TMDB details lazily), 404 otherwise |
| GET | `/:id/similar` | none | Up to 8 titles, same genre first |
| POST | `/` | admin | Create (`title`, `year` required) -> 201 |
| PATCH | `/:id` | admin | Partial update |
| DELETE | `/:id` | admin | 204; also removes it from watchlists |

`Movie = {id, title, poster, rating, duration, year, description, genre, cast[], trailer?, imdbId?, mediaType}`, plus for TMDB titles `tmdbId, originalTitle, originalLanguage, tagline, backdrop, releaseDate, runtime, genres[], subgenres[], voteCount, certification, trailerKey, directors[]`, and on the detail endpoint `castDetails[{name, character, profile}], keywords[], providers{region, link, flatrate[], rent[], buy[], free[], ads[]}`. Category rows also carry a `key`.

### Watchlist (`/api/watchlist`, user)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | none | `[{movie_id, added_at, movie: Movie or null}]`, newest first |
| POST | `/` | `{movie_id}` | Toggle -> `{message, inWatchlist}` (404 for an unknown movie) |
| PUT | `/:movieId` | none | Idempotent add -> 201 created / 200 already present |
| DELETE | `/:movieId` | none | 204, or 404 if not in the list |

### Profile (`/api/profile`, user)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | none | `{id, email, username, role, favorite_genre, avatar_url, created_at}` |
| PUT / PATCH | `/` | `{username?, favorite_genre?, avatar_url?}` | Updated profile (409 if the username is taken) |

### Admin (`/api/admin`, admin only: 401 anonymous, 403 for users)
| Method | Path | Notes |
|---|---|---|
| GET | `/stats` | `{users, admins, movies, watchlistEntries, catalog: {source, moviesBySource, tmdb: {configured, status, tmdbMovies, daily, full}}, mostWatchlisted[]}` |
| POST | `/sync/tmdb` | `{mode?: "daily" or "full", reset?: boolean}` runs about 25 s of the resumable import; repeat until `done`. 200 no-op without a TMDB key |
| GET | `/users?q=&page=&limit=` | Paginated user search |
| PATCH | `/users/:id/role` | `{role: "user" or "admin"}`; revokes the target's sessions; no self-demotion |
| DELETE | `/users/:id` | 204; cascades the watchlist; no self-deletion |

---

## 👨‍💻 Author

Ekansh Singh
