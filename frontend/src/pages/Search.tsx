import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import type { Movie } from "@/data/movies";

const Search = () => {
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/movies")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const uniqueMap = new Map<string, Movie>();
          data.forEach((cat: { movies?: Movie[] }) => {
            if (Array.isArray(cat.movies)) {
              cat.movies.forEach((m: Movie) => {
                uniqueMap.set(m.id, m);
              });
            }
          });
          setMovies(Array.from(uniqueMap.values()));
        }
      })
      .catch(err => console.error("Error loading movies for search:", err))
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return movies;
    const q = query.toLowerCase();
    return movies.filter(
      m => m.title.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q) || String(m.year).includes(q)
    );
  }, [query, movies]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <h1 className="font-horror text-3xl text-primary text-glow-red tracking-wider mb-6">Search</h1>

        <div className="relative max-w-lg mb-8">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search by title, genre, or year..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-10 bg-muted border-border focus:border-primary"
            disabled={loading}
          />
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground mt-4 font-horror text-sm tracking-widest">Searching the shadows...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-4">
              {results.map(m => <MovieCard key={m.id} movie={m} />)}
            </div>

            {results.length === 0 && (
              <p className="text-muted-foreground text-center mt-12">No movies found in the shadows...</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
