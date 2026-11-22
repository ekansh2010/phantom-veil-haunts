import { useState, useCallback, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Play, Plus, Check, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import IntroScreen from "@/components/IntroScreen";
import Navbar from "@/components/Navbar";
import HeroGraveyard from "@/components/HeroGraveyard";
import MovieRow from "@/components/MovieRow";
import FogEffect from "@/components/FogEffect";
import type { Movie } from "@/data/movies";

// Inner Spotlight Billboard component
const FeaturedSpotlight = ({ movie }: { movie: Movie }) => {
  const [inWatchlist, setInWatchlist] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !movie) return;
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
          const found = data.some((w: { movie_id: string }) => w.movie_id === movie.id);
          setInWatchlist(found);
        }
      })
      .catch(err => console.error("Error fetching watchlist:", err));
  }, [user, movie]);

  const toggleWatchlist = async () => {
    if (!movie) return;
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
        body: JSON.stringify({ movie_id: movie.id })
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

  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-12 border border-red-950/30 bg-gradient-to-r from-deep-black via-deep-black/90 to-transparent p-6 md:p-12 min-h-[440px] flex flex-col justify-center shadow-[0_0_50px_rgba(0,0,0,0.85)]">
      {/* Backdrop Image */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none">
        <img
          src={movie.poster}
          alt={movie.title}
          className="absolute right-0 top-0 w-full md:w-3/5 h-full object-cover opacity-35 md:opacity-40"
        />
        {/* Gradients to fade backdrop */}
        <div className="absolute inset-0 bg-gradient-to-r from-deep-black via-deep-black/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-deep-black via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-2xl flex flex-col items-start gap-4">
        <span className="px-3 py-1 text-[10px] tracking-[0.25em] font-semibold text-primary uppercase border border-primary/50 bg-primary/5 rounded-full select-none animate-pulse">
          Featured Haunt
        </span>
        <h2 className="font-horror text-4xl md:text-6xl text-foreground text-glow-red tracking-wider select-none leading-none">
          {movie.title}
        </h2>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1 text-primary">
            <Star size={14} fill="currentColor" /> {movie.rating}
          </span>
          <span>{movie.duration}</span>
          <span>{movie.year}</span>
          <span className="px-2 py-0.5 border border-border rounded text-[10px] tracking-wide bg-muted/40 uppercase">
            {movie.genre}
          </span>
        </div>
        <p className="text-foreground/80 leading-relaxed text-sm md:text-base mt-2">
          {movie.description}
        </p>
        <div className="mt-2 text-xs">
          <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Starring Cast</span>
          <p className="text-foreground/60 mt-0.5">{movie.cast.join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          <Link
            to={`/movie/${movie.id}`}
            className="btn-horror px-8 py-3 rounded-lg flex items-center gap-2 font-horror text-base tracking-wider text-primary-foreground hover:scale-105 transition-transform"
          >
            <Play size={16} className="fill-current" /> Play Now
          </Link>
          <button
            onClick={toggleWatchlist}
            className="px-6 py-3 rounded-lg border border-red-950/40 bg-red-950/10 hover:bg-red-950/20 text-foreground flex items-center gap-2 transition-colors text-sm font-medium tracking-wide"
          >
            {inWatchlist ? <Check size={16} className="text-primary" /> : <Plus size={16} />}
            {inWatchlist ? "In My List" : "My List"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window !== "undefined") {
      return !sessionStorage.getItem("pv_intro_shown");
    }
    return true;
  });
  const [categories, setCategories] = useState<{ title: string; movies: Movie[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const { hash } = useLocation();

  const handleIntroComplete = useCallback(() => {
    sessionStorage.setItem("pv_intro_shown", "true");
    setShowIntro(false);
  }, []);

  const scrollIntoMovies = () => {
    const el = document.getElementById("movies-catalog");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    fetch("/api/movies")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch(err => console.error("Error loading movies:", err))
      .finally(() => setLoading(false));
  }, []);

  // Listen to hash changes and scroll to targets (e.g. #trending, #movies)
  useEffect(() => {
    if (hash) {
      const targetId = hash.replace("#", "");
      const actualId = targetId === "movies" ? "movies-catalog" : targetId;
      const element = document.getElementById(actualId);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 200);
      }
    }
  }, [hash, loading]);

  // Select the featured movie (usually "The Whisper" or the first trending item)
  const featuredMovie = categories[0]?.movies?.find(m => m.id === "3") || categories[0]?.movies[0];

  return (
    <>
      {showIntro && <IntroScreen onComplete={handleIntroComplete} />}
      <div className="min-h-screen bg-background">
        <Navbar />
        <HeroGraveyard onEnterHorror={scrollIntoMovies} />
        
        {loading ? (
          <div className="relative z-10 -mt-20 py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground mt-4 font-horror text-sm tracking-widest animate-pulse">Summoning categories...</p>
          </div>
        ) : (
          <div id="movies-catalog" className="relative z-10 -mt-20 bg-gradient-to-b from-transparent via-deep-black/60 to-black/95 py-10 px-4 md:px-8 border-t border-red-950/20">
            {/* Ambient blood red glow in the background of the catalog */}
            <div className="absolute top-10 left-1/4 w-96 h-96 bg-red-950/15 rounded-full filter blur-[100px] pointer-events-none" />
            <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-red-950/10 rounded-full filter blur-[100px] pointer-events-none" />
            
            {/* Featured Spotlight Banner */}
            {featuredMovie && <FeaturedSpotlight movie={featuredMovie} />}

            {/* Catalog Movie Rows */}
            {categories.map(cat => {
              const isTrending = cat.title.toLowerCase().includes("trending");
              return (
                <MovieRow 
                  key={cat.title} 
                  title={cat.title} 
                  movies={cat.movies} 
                  id={isTrending ? "trending" : undefined}
                />
              );
            })}
          </div>
        )}

        {/* Spooky Gothic Footer */}
        <footer className="relative bg-deep-black border-t border-red-950/30 py-16 px-6 overflow-hidden">
          {/* Faint red glow overlay in footer */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[150px] bg-red-950/10 rounded-full filter blur-[80px] pointer-events-none" />
          
          <div className="container mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-4 gap-10 relative z-10">
            {/* Logo and Tagline */}
            <div className="md:col-span-2 space-y-4">
              <span className="font-horror text-3xl text-primary text-glow-red tracking-wider">
                PHANTOM VEIL
              </span>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                Step inside the shadows of cinema. The ultimate resting place for horror enthusiasts, spooky tales, and classic nightmares.
              </p>
              <p className="text-[11px] text-primary/70 italic tracking-wide">
                "By entering the veil, you agree to leave your sanity at the gates."
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
              <h4 className="font-horror text-lg text-primary tracking-wide">Enter the Depths</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="hover:text-primary transition-colors">Home Graveyard</Link></li>
                <li><a href="#movies" className="hover:text-primary transition-colors">Haunted Catalog</a></li>
                <li><Link to="/search" className="hover:text-primary transition-colors">Summon Search</Link></li>
                <li><Link to="/profile" className="hover:text-primary transition-colors">Your Shadow List</Link></li>
              </ul>
            </div>

            {/* Newsletter */}
            <div className="space-y-4">
              <h4 className="font-horror text-lg text-primary tracking-wide">Summon News</h4>
              <p className="text-xs text-muted-foreground">
                Subscribe to get whispers of new releases and classic nightmares direct to your inbox.
              </p>
              <form onSubmit={e => e.preventDefault()} className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your mortal email..."
                  className="px-3 py-2 text-xs bg-muted/30 border border-red-950/40 rounded focus:border-primary focus:outline-none text-foreground w-full placeholder:text-muted-foreground/50 transition-colors"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs btn-horror rounded font-horror text-primary-foreground tracking-wider transition-transform hover:scale-105 active:scale-95"
                >
                  Summon
                </button>
              </form>
            </div>
          </div>

          <div className="container mx-auto max-w-6xl mt-12 pt-8 border-t border-red-950/20 text-center relative z-10">
            <div className="flex justify-center gap-6 mb-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors" title="Twitter/X">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors" title="GitHub">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 Phantom Veil. Built for the shadows. All rights reserved.
            </p>
          </div>
        </footer>
        <FogEffect />
      </div>
    </>
  );
};

export default Index;
