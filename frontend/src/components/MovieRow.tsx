import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MovieCard from "./MovieCard";
import type { Movie } from "@/data/movies";

const MovieRow = ({ title, movies, id, href }: { title: string; movies: Movie[]; id?: string; href?: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -600 : 600, behavior: "smooth" });
    }
  };

  return (
    <section id={id} className="py-6">
      <div className="flex items-baseline justify-between gap-4 mb-4 px-6 md:px-12">
        <h2 className="font-horror text-2xl md:text-3xl text-primary text-glow-red tracking-wider select-none hover:text-red-400 transition-colors duration-300">
          {title}
        </h2>
        {href && (
          <Link to={href} className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors whitespace-nowrap">
            See all
          </Link>
        )}
      </div>
      <div className="relative group/row">
        {/* Scroll buttons */}
        <button
          aria-label="Scroll left"
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-background to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center"
        >
          <ChevronLeft className="text-foreground hover:text-primary transition-colors duration-200" />
        </button>
        <button
          aria-label="Scroll right"
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-background to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center"
        >
          <ChevronRight className="text-foreground hover:text-primary transition-colors duration-200" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-6 md:px-12 pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {movies.map(movie => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default MovieRow;
