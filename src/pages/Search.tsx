import { useState, useMemo } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import { getAllMovies } from "@/data/movies";

const Search = () => {
  const [query, setQuery] = useState("");
  const allMovies = getAllMovies();

  const results = useMemo(() => {
    if (!query.trim()) return allMovies;
    const q = query.toLowerCase();
    return allMovies.filter(
      m => m.title.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q) || String(m.year).includes(q)
    );
  }, [query, allMovies]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16">
        <h1 className="font-horror text-3xl text-primary text-glow-red tracking-wider mb-6">Search</h1>

        <div className="relative max-w-lg mb-8">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search by title, genre, or year..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-10 bg-muted border-border focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          {results.map(m => <MovieCard key={m.id} movie={m} />)}
        </div>

        {results.length === 0 && (
          <p className="text-muted-foreground text-center mt-12">No movies found in the shadows...</p>
        )}
      </div>
    </div>
  );
};

export default Search;
