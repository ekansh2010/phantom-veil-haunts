import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import { getMovieById } from "@/data/movies";
import type { Movie } from "@/data/movies";

const GENRES = ["Supernatural Horror", "Psychological Horror", "Zombie Apocalypse", "Haunted House", "Classic Horror"];

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<{ username: string; favorite_genre: string }>({ username: "", favorite_genre: "" });
  const [saving, setSaving] = useState(false);
  const [watchlistMovies, setWatchlistMovies] = useState<Movie[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("pv_auth_token");
    if (!token) return;

    fetch("/api/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setProfile({ username: data.username || "", favorite_genre: data.favorite_genre || "" });
        }
      })
      .catch(err => console.error("Error fetching profile:", err));

    fetch("/api/watchlist", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // The API returns each entry with its movie resolved; fall back to the bundled catalog.
          const movies = data
            .map((w: { movie_id: string; movie: Movie | null }) => w.movie ?? getMovieById(w.movie_id))
            .filter(Boolean) as Movie[];
          setWatchlistMovies(movies);
        }
      })
      .catch(err => console.error("Error fetching watchlist:", err));
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const token = localStorage.getItem("pv_auth_token");
    if (!token) return;

    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: profile.username,
          favorite_genre: profile.favorite_genre
        })
      });

      const data = await response.json();
      setSaving(false);

      if (!response.ok) {
        toast({ title: "Error", description: data.error || "Failed to update profile", variant: "destructive" });
      } else {
        toast({ title: "Profile updated!" });
      }
    } catch (err) {
      setSaving(false);
      const errorMessage = err instanceof Error ? err.message : "Failed to update profile";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <h1 className="font-horror text-3xl text-primary text-glow-red tracking-wider mb-8">Your Profile</h1>

        <div className="card-horror rounded-xl p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center font-horror text-2xl text-primary">
              {profile.username?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-foreground font-medium">{profile.username || "Unknown"}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Username</label>
              <Input value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Favorite Genre</label>
              <select
                value={profile.favorite_genre}
                onChange={e => setProfile(p => ({ ...p, favorite_genre: e.target.value }))}
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-foreground text-sm"
              >
                <option value="">Select genre</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="flex gap-4">
              <button onClick={handleSave} disabled={saving} className="btn-horror px-6 py-2 rounded-lg text-primary-foreground text-sm">
                {saving ? "Saving..." : "Save Profile"}
              </button>
              <button onClick={async () => { await signOut(); navigate("/"); }} className="px-6 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>

        {watchlistMovies.length > 0 && (
          <div className="mt-12">
            <h2 className="font-horror text-2xl text-foreground tracking-wider mb-4">My Watchlist</h2>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {watchlistMovies.map(m => <MovieCard key={m.id} movie={m} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
