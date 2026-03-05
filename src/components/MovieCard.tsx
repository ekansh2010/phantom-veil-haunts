import { Link } from "react-router-dom";
import { Play, Star } from "lucide-react";
import type { Movie } from "@/data/movies";

const MovieCard = ({ movie }: { movie: Movie }) => (
  <Link
    to={`/movie/${movie.id}`}
    className="group relative flex-shrink-0 w-[160px] md:w-[200px] card-horror rounded-lg overflow-hidden"
  >
    <div className="relative aspect-[2/3] overflow-hidden">
      <img
        src={movie.poster}
        alt={movie.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />
      {/* Fog overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-400">
        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
          <Play size={20} className="text-primary-foreground ml-0.5" />
        </div>
      </div>
    </div>
    <div className="p-3">
      <h3 className="text-sm font-medium text-foreground truncate">{movie.title}</h3>
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 text-primary">
          <Star size={12} fill="currentColor" /> {movie.rating}
        </span>
        <span>{movie.duration}</span>
      </div>
    </div>
  </Link>
);

export default MovieCard;
