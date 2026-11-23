import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import SiteFooter from "@/components/SiteFooter";
import { fetchBrowse, fetchSearch } from "@/lib/movies";

const PAGE_SIZE = 24;

/** Server-side search (title, cast, director, genre). With TMDB enabled, unknown titles are looked up there too. */
const Search = () => {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(query.trim());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced) next.set("q", debounced);
    else next.delete("q");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [debounced, params, setParams]);

  const results = useInfiniteQuery({
    queryKey: ["search", debounced],
    // Empty query: show the most popular titles instead of nothing.
    queryFn: ({ pageParam }) => (debounced ? fetchSearch(debounced, pageParam, PAGE_SIZE) : fetchBrowse({ sort: "popularity" }, pageParam, PAGE_SIZE)),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    staleTime: 60_000,
  });

  const movies = useMemo(() => {
    const seen = new Set<string>();
    return (results.data?.pages ?? []).flatMap((p) => p.items).filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [results.data]);
  const total = results.data?.pages[0]?.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <h1 className="font-horror text-3xl text-primary text-glow-red tracking-wider mb-6">Search</h1>

        <div className="relative max-w-lg mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            aria-label="Search movies"
            placeholder="Search by title, cast, director or genre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 bg-muted border-border focus:border-primary"
            autoFocus
          />
        </div>
        <p className="text-xs text-muted-foreground mb-8">
          {results.isSuccess && (debounced ? `${total} result${total === 1 ? "" : "s"} for "${debounced}"` : "Popular right now")}
          {" · "}
          <Link to="/browse" className="text-primary hover:underline">
            Browse with filters
          </Link>
        </p>

        {results.isPending ? (
          <div className="py-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground mt-4 font-horror text-sm tracking-widest">Searching the shadows...</p>
          </div>
        ) : results.isError ? (
          <p className="text-muted-foreground text-center mt-12">The search was swallowed by the dark. Try again.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4">
              {movies.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>

            {movies.length === 0 && <p className="text-muted-foreground text-center mt-12">No movies found in the shadows...</p>}

            {results.hasNextPage && (
              <div className="mt-10 text-center">
                <button
                  onClick={() => results.fetchNextPage()}
                  disabled={results.isFetchingNextPage}
                  className="btn-horror px-8 py-3 rounded-lg font-horror tracking-wider text-primary-foreground disabled:opacity-60"
                >
                  {results.isFetchingNextPage ? "Summoning..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
};

export default Search;
