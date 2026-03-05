import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Plus, Check, Star, Clock, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { getMovieById, movieCategories } from "@/data/movies";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import MovieRow from "@/components/MovieRow";

const MovieDetail = () => {
  const { id } = useParams();
  const movie = getMovieById(id || "");
  const { user } = useAuth();
  const { toast } = useToast();
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    supabase.from("watchlist").select("id").eq("user_id", user.id).eq("movie_id", id).maybeSingle()
      .then(({ data }) => setInWatchlist(!!data));
  }, [user, id]);

  const toggleWatchlist = async () => {
    if (!user) {
      toast({ title: "Login required", description: "Sign in to add movies to your list.", variant: "destructive" });
      return;
    }
    if (inWatchlist) {
      await supabase.from("watchlist").delete().eq("user_id", user.id).eq("movie_id", id!);
      setInWatchlist(false);
      toast({ title: "Removed from watchlist" });
    } else {
      await supabase.from("watchlist").insert({ user_id: user.id, movie_id: id! });
      setInWatchlist(true);
      toast({ title: "Added to watchlist!" });
    }
  };

  if (!movie) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Movie not found.</p>
      </div>
    );
  }

  const similar = movieCategories.find(c => c.title === "Trending Horror")!;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <div className="relative h-[70vh] overflow-hidden">
        <img src={movie.poster} alt={movie.title} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-16 z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft size={18} /> Back
          </Link>

          <motion.h1
            className="font-horror text-4xl md:text-7xl text-foreground text-glow-moon tracking-wider"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {movie.title}
          </motion.h1>

          <div className="flex items-center gap-6 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-primary">
              <Star size={16} fill="currentColor" /> {movie.rating}
            </span>
            <span className="flex items-center gap-1"><Clock size={14} /> {movie.duration}</span>
            <span className="flex items-center gap-1"><Calendar size={14} /> {movie.year}</span>
            <span className="px-2 py-0.5 border border-border rounded text-xs">{movie.genre}</span>
          </div>

          <p className="mt-4 text-foreground/80 max-w-xl text-sm md:text-base leading-relaxed">
            {movie.description}
          </p>

          <div className="flex gap-4 mt-6">
            <button className="btn-horror px-8 py-3 rounded-lg flex items-center gap-2 font-medium text-primary-foreground">
              <Play size={18} /> Play
            </button>
            <button
              onClick={toggleWatchlist}
              className="px-6 py-3 rounded-lg border border-border bg-muted/50 hover:bg-muted text-foreground flex items-center gap-2 transition-colors"
            >
              {inWatchlist ? <Check size={18} /> : <Plus size={18} />}
              {inWatchlist ? "In My List" : "My List"}
            </button>
          </div>

          <div className="mt-6">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Cast</span>
            <p className="text-sm text-foreground/70 mt-1">{movie.cast.join(" · ")}</p>
          </div>
        </div>
      </div>

      {/* Similar */}
      <div className="pb-16">
        <MovieRow title="You Might Also Like" movies={similar.movies} />
      </div>
    </div>
  );
};

export default MovieDetail;
