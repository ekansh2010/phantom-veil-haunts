import { useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import SiteFooter from "@/components/SiteFooter";
import {
  DECADE_OPTIONS,
  RATING_OPTIONS,
  SORT_OPTIONS,
  SUBGENRE_OPTIONS,
  fetchBrowse,
  type BrowseFilters,
  type BrowseSort,
} from "@/lib/movies";

const PAGE_SIZE = 24;

const selectClass =
  "w-full bg-muted/40 border border-red-950/40 rounded-md px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none transition-colors";

const FilterSelect = ({
  id,
  label,
  value,
  onChange,
  options,
  anyLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  anyLabel?: string;
}) => (
  <div className="flex flex-col gap-1 min-w-[150px] flex-1">
    <label htmlFor={id} className="text-[10px] uppercase tracking-widest text-muted-foreground">
      {label}
    </label>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      {anyLabel !== undefined && <option value="">{anyLabel}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

const Browse = () => {
  const [params, setParams] = useSearchParams();
  const filters: BrowseFilters = useMemo(
    () => ({
      subgenre: params.get("subgenre") ?? "",
      decade: params.get("decade") ?? "",
      minRating: params.get("minRating") ?? "",
      sort: (params.get("sort") as BrowseSort) || "popularity",
    }),
    [params],
  );

  const setFilter = (key: keyof BrowseFilters, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const query = useInfiniteQuery({
    queryKey: ["browse", filters],
    queryFn: ({ pageParam }) => fetchBrowse(filters, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    staleTime: 60_000,
  });

  const movies = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? []).flatMap((p) => p.items).filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const source = query.data?.pages[0]?.source;

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const hasFilters = Boolean(filters.subgenre || filters.decade || filters.minRating || filters.sort !== "popularity");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <h1 className="font-horror text-3xl md:text-4xl text-primary text-glow-red tracking-wider mb-2">Browse the Library</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {query.isSuccess ? `${total.toLocaleString()} ${total === 1 ? "title" : "titles"} lurking` : "Counting the dead..."}
          {source === "tmdb" ? " · data from TMDB" : ""}
        </p>

        <section aria-label="Filters" className="flex flex-wrap items-end gap-4 mb-8 p-4 rounded-lg border border-red-950/30 bg-deep-black/60">
          <SlidersHorizontal className="text-primary hidden md:block mb-2" size={18} aria-hidden />
          <FilterSelect
            id="filter-subgenre"
            label="Sub-genre"
            value={filters.subgenre ?? ""}
            onChange={(v) => setFilter("subgenre", v)}
            anyLabel="All horror"
            options={SUBGENRE_OPTIONS.map((s) => ({ value: s.key, label: s.label }))}
          />
          <FilterSelect
            id="filter-decade"
            label="Decade"
            value={filters.decade ?? ""}
            onChange={(v) => setFilter("decade", v)}
            anyLabel="Any decade"
            options={DECADE_OPTIONS.map((d) => ({ value: d, label: `${d}s` }))}
          />
          <FilterSelect
            id="filter-rating"
            label="Rating"
            value={filters.minRating ?? ""}
            onChange={(v) => setFilter("minRating", v)}
            anyLabel="Any rating"
            options={RATING_OPTIONS.map((r) => ({ value: r, label: `${r}+ stars` }))}
          />
          <FilterSelect
            id="filter-sort"
            label="Sort by"
            value={filters.sort ?? "popularity"}
            onChange={(v) => setFilter("sort", v === "popularity" ? "" : v)}
            options={SORT_OPTIONS.map((s) => ({ value: s.key, label: s.label }))}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="px-4 py-2 text-xs uppercase tracking-widest border border-red-950/40 rounded-md text-muted-foreground hover:text-primary hover:border-primary transition-colors"
            >
              Reset
            </button>
          )}
        </section>

        {query.isPending ? (
          <div className="py-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground mt-4 font-horror text-sm tracking-widest">Summoning the library...</p>
          </div>
        ) : query.isError ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>The spirits refused to answer.</p>
            <button onClick={() => query.refetch()} className="mt-4 text-primary hover:underline text-sm">
              Try again
            </button>
          </div>
        ) : movies.length === 0 ? (
          <p className="text-muted-foreground text-center mt-12">No movies match these filters... yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              {movies.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
            <div ref={sentinel} className="h-1" aria-hidden />
            <div className="mt-10 text-center">
              {hasNextPage ? (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="btn-horror px-8 py-3 rounded-lg font-horror tracking-wider text-primary-foreground disabled:opacity-60"
                >
                  {isFetchingNextPage ? "Summoning..." : "Load more"}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground tracking-widest uppercase">You have reached the bottom of the crypt</p>
              )}
            </div>
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
};

export default Browse;
