import { Link } from "react-router-dom";
import { Play, Star } from "lucide-react";
import type { Movie } from "@/data/movies";

const MovieCard = ({ movie }: { movie: Movie }) => (
  <Link
    to={`/movie/${movie.id}`}
    className="group relative flex-shrink-0 w-[160px] md:w-[200px] card-horror rounded-lg overflow-hidden shadow-lg transition-transform duration-400"
  >
    <div className="relative aspect-[2/3] overflow-hidden">
      <img
        src={movie.poster}
        alt={movie.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        onError={e => {
          // Missing/expired remote poster: fall back to a bundled one (once).
          const img = e.currentTarget;
          if (!img.src.endsWith("/posters/poster3.jpg")) img.src = "/posters/poster3.jpg";
        }}
      />
      {/* Red/Black mist gradient rise overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-deep-black via-red-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
      {/* Solid filled pulsing play button */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-400">
        <div className="w-12 h-12 rounded-full bg-primary/95 flex items-center justify-center shadow-[0_0_20px_rgba(200,0,0,0.8)] transform scale-90 group-hover:scale-100 transition-transform duration-300">
          <Play size={20} className="text-primary-foreground fill-current ml-0.5" />
        </div>
      </div>
    </div>
    <div className="p-3">
      <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors duration-300">
        {movie.title}
      </h3>
      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 text-primary font-medium">
          <Star size={12} fill="currentColor" /> {movie.rating}
        </span>
        <div className="flex items-center gap-1.5">
          <span>{movie.year}</span>
          <span className="text-[9px] px-1 py-0.5 bg-red-950/30 border border-red-950/40 rounded text-primary-foreground uppercase scale-90">
            {movie.duration}
          </span>
        </div>
      </div>
    </div>
  </Link>
);

export default MovieCard;
