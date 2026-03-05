import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
    supabase.from("profiles").select("username, favorite_genre").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) setProfile({ username: data.username || "", favorite_genre: data.favorite_genre || "" });
      });

    supabase.from("watchlist").select("movie_id").eq("user_id", user.id)
      .then(({ data }) => {
        if (data) {
          const movies = data.map(w => getMovieById(w.movie_id)).filter(Boolean) as Movie[];
          setWatchlistMovies(movies);
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      username: profile.username,
      favorite_genre: profile.favorite_genre,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Profile updated!" });
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-16 max-w-2xl">
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
              <button onClick={() => { signOut(); navigate("/"); }} className="px-6 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors">
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
