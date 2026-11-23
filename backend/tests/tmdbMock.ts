import fs from "fs";
import path from "path";
import { vi } from "vitest";

export const fixture = <T = any>(name: string): T => // eslint-disable-line @typescript-eslint/no-explicit-any
  JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "tmdb", name), "utf8"));

export const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  }) as Response;

export type Route = (url: URL) => Response | Promise<Response> | undefined;

/**
 * A fetch mock for api.themoviedb.org that routes by path. Unknown TMDB paths
 * return an empty page; any other host returns 404 (e.g. TVmaze).
 */
export const createTmdbFetch = (routes: Record<string, Route | unknown> = {}) =>
  vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.hostname !== "api.themoviedb.org") return jsonResponse({}, 404);
    const p = url.pathname.replace(/^\/3/, "");
    const route = routes[p];
    if (typeof route === "function") {
      const res = await (route as Route)(url);
      if (res) return res;
    } else if (route !== undefined) return jsonResponse(route);
    if (p === "/discover/movie" || p === "/search/movie" || p === "/search/keyword") return jsonResponse({ page: 1, total_pages: 0, results: [] });
    return jsonResponse({ status_message: "not found" }, 404);
  });

export const calledPaths = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map((c) => new URL(String(c[0])).pathname.replace(/^\/3/, ""));
