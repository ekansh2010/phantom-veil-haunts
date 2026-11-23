import type { Movie } from "@/data/movies";

export interface Category {
  key?: string;
  title: string;
  movies: Movie[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source?: "tmdb" | "fallback";
}

export type BrowseSort = "popularity" | "rating" | "newest" | "oldest" | "title";

export interface BrowseFilters {
  subgenre?: string;
  decade?: string;
  minRating?: string;
  sort?: BrowseSort;
}

export const SUBGENRE_OPTIONS = [
  { key: "supernatural", label: "Supernatural" },
  { key: "psychological", label: "Psychological" },
  { key: "slasher", label: "Slasher" },
  { key: "zombie", label: "Zombie" },
  { key: "haunted-house", label: "Haunted House" },
  { key: "classic", label: "Classic (pre-1980)" },
];

export const SORT_OPTIONS: Array<{ key: BrowseSort; label: string }> = [
  { key: "popularity", label: "Most popular" },
  { key: "rating", label: "Highest rated" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "title", label: "Title A-Z" },
];

export const DECADE_OPTIONS = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930, 1920].map(String);

export const RATING_OPTIONS = ["8", "7", "6", "5"];

/** Builds a query string, dropping empty values. */
export const toQuery = (params: Record<string, string | number | undefined>): string => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
};

const getJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
};

export const fetchBrowse = (filters: BrowseFilters, page: number, limit = 24) =>
  getJson<Paged<Movie>>(`/api/movies/browse${toQuery({ ...filters, page, limit })}`);

export const fetchSearch = (q: string, page: number, limit = 24) => getJson<Paged<Movie>>(`/api/movies/search${toQuery({ q, page, limit })}`);

/** Where a home row's "See all" link goes. */
export const browseHrefForRow = (key?: string): string | undefined => {
  if (!key) return undefined;
  if (SUBGENRE_OPTIONS.some((s) => s.key === key)) return `/browse?subgenre=${key}`;
  if (key === "trending") return "/browse?sort=popularity";
  if (key === "top-rated") return "/browse?sort=rating";
  if (key === "new") return "/browse?sort=newest";
  return undefined;
};

/** YouTube embed for a TMDB trailer key (privacy-enhanced domain). */
export const youtubeEmbedUrl = (key: string) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0`;

export const formatVotes = (n?: number) => (n === undefined ? "" : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
