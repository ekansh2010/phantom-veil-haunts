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

- **Catalog**: home-page rows (Trending, New Nightmares, Supernatural, Psychological, Classic, Zombie, Haunted House) built from MongoDB.
- **Live titles**: horror shows are synced from TVmaze (or TMDB when `TMDB_API_KEY` is set) into MongoDB at most once per 24 h, shared by every serverless instance. If the upstream API fails, the stored catalog is still served.
- **Movie detail and recommendations**: unknown `tv-*` / `tmdb-*` ids are fetched on demand, so deep links work.
- **Search**: by title, description, genre or cast, with pagination. User input is regex-escaped.
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
| Backend integration (`backend/tests/integration`): app, auth, movies, watchlist, profile, admin, seed, external catalog | 8 | 89 |
| Backend unit (`backend/tests/unit`): env, helpers/serializers, validation, mappers | 4 | 28 |
| Frontend (`frontend/src/test`): useAuth, api helpers, ResetPassword, example | 4 | 14 |
| **Total** | **16** | **131** |

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
| `TMDB_API_KEY` | no | none | Use TMDB instead of TVmaze |
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

### Render / Railway / Docker

`render.yaml` and `Procfile` run `npm run build` and then `npm start` (`tsx backend/index.ts`), which serves the API and the SPA from one process. Set the same env vars.

---

## API reference

All responses are JSON. Errors look like `{ "error": "message", "details"?: [{ "path", "message" }] }`. Authenticated routes need `Authorization: Bearer <token>`.

### Health
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | none | `200 {status, db:"connected"}` or `503` |

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
| GET | `/search?q=&genre=&page=&limit=` | none | `{items, total, page, limit, totalPages}` (limit at most 50) |
| GET | `/:id` | none | `Movie` (fetches `tv-*`/`tmdb-*` on demand), 404 otherwise |
| GET | `/:id/similar` | none | Up to 8 titles, same genre first |
| POST | `/` | admin | Create (`title`, `year` required) -> 201 |
| PATCH | `/:id` | admin | Partial update |
| DELETE | `/:id` | admin | 204; also removes it from watchlists |

`Movie = {id, title, poster, rating, duration, year, description, genre, cast[], trailer?, imdbId?, mediaType}`

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
| GET | `/stats` | `{users, admins, movies, watchlistEntries, mostWatchlisted[]}` |
| GET | `/users?q=&page=&limit=` | Paginated user search |
| PATCH | `/users/:id/role` | `{role: "user" or "admin"}`; revokes the target's sessions; no self-demotion |
| DELETE | `/users/:id` | 204; cascades the watchlist; no self-deletion |

---

## 👨‍💻 Author

Ekansh Singh
