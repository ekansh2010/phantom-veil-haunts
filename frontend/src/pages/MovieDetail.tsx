import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Plus, Check, Star, Clock, Calendar, X } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import MovieRow from "@/components/MovieRow";
import type { Movie } from "@/data/movies";

const getVidkingEmbedUrl = (movie: Movie) => {
  const color = "d41515"; // Phantom Veil's brand color
  const identifier = movie.imdbId || movie.id;
  const isTv = movie.mediaType === "tv";

  if (isTv) {
    return `https://www.vidking.net/embed/tv/${identifier}/1/1?color=${color}&autoPlay=true&episodeSelector=true&nextEpisode=true`;
  }
  return `https://www.vidking.net/embed/movie/${identifier}?color=${color}&autoPlay=true`;
};

const MovieDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/movies/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setMovie(data);
        } else {
          setMovie(null);
        }
      })
      .catch(err => {
        console.error("Error loading movie detail:", err);
        setMovie(null);
      })
      .finally(() => setLoading(false));

    fetch(`/api/movies/${id}/similar`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSimilarMovies(data);
        }
      })
      .catch(err => console.error("Error loading recommendations:", err));
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    const token = localStorage.getItem("pv_auth_token");
    if (!token) return;

    fetch("/api/watchlist", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const found = data.some((w: { movie_id: string }) => w.movie_id === id);
          setInWatchlist(found);
        }
      })
      .catch(err => console.error("Error fetching watchlist:", err));
  }, [user, id]);

  const toggleWatchlist = async () => {
    if (!user) {
      toast({ title: "Login required", description: "Sign in to add movies to your list.", variant: "destructive" });
      return;
    }
    const token = localStorage.getItem("pv_auth_token");
    if (!token) return;

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ movie_id: id })
      });

      const data = await response.json();
      if (response.ok) {
        setInWatchlist(data.inWatchlist);
        toast({ title: data.message || (data.inWatchlist ? "Added to watchlist!" : "Removed from watchlist") });
      } else {
        toast({ title: "Error", description: data.error || "Failed to update watchlist", variant: "destructive" });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update watchlist";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground mt-4 font-horror text-sm tracking-widest">Entering the void...</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground font-horror">The nightmare was not found.</p>
        <Link to="/" className="text-primary hover:underline text-sm flex items-center gap-2">
          <ArrowLeft size={16} /> Return to Graveyard
        </Link>
      </div>
    );
  }

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
            <button 
              onClick={() => setIsPlaying(true)}
              className="btn-horror px-8 py-3 rounded-lg flex items-center gap-2 font-medium text-primary-foreground hover:scale-105 transition-transform"
            >
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
      {similarMovies.length > 0 && (
        <div className="pb-16">
          <MovieRow title="You Might Also Like" movies={similarMovies} />
        </div>
      )}

      {/* Video Player Modal */}
      {isPlaying && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden border border-red-950/40 shadow-[0_0_50px_rgba(220,38,38,0.35)]">
            <button
              onClick={() => setIsPlaying(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-red-950/60 hover:bg-primary text-foreground transition-colors border border-red-950/40 shadow-[0_0_10px_rgba(220,38,38,0.4)]"
            >
              <X size={20} />
            </button>
            {["1", "2", "3", "4", "5", "6", "7", "8"].includes(movie.id) ? (
              movie.trailer ? (
                <video
                  src={movie.trailer}
                  title={`${movie.title} Trailer`}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  playsInline
                  loop
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground font-horror">
                  No preview available.
                </div>
              )
            ) : (
              <iframe
                src={getVidkingEmbedUrl(movie)}
                title={`${movie.title} Player`}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieDetail;
