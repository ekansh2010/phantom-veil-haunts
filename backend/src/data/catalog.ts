import type { IMovie } from "../models/index.js";

type SeedMovie = Omit<IMovie, "createdAt" | "updatedAt">;

/** Royalty-free Mixkit stock clips (Mixkit License). */
const mixkitClip = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;

const TRAILERS = {
  fogWalk: mixkitClip(41618),
  cabin: mixkitClip(41620),
  bwForest: mixkitClip(41619),
  facePaint: mixkitClip(41622),
  lightning: mixkitClip(41621),
} as const;

/**
 * Mixkit retired its old `/videos/preview/mixkit-<slug>-<id>-large.mp4` URLs (they now answer 403).
 * Rows seeded before the move still store them, so rewrite to the current URL on the way out.
 */
const LEGACY_MIXKIT = /^https:\/\/assets\.mixkit\.co\/videos\/preview\/mixkit-[a-z0-9-]*?-(\d+)-large\.mp4$/i;
export const normalizeTrailerUrl = (url: string): string => {
  const m = LEGACY_MIXKIT.exec(url);
  return m ? mixkitClip(Number(m[1])) : url;
};

/** Picks an atmospheric looping clip for titles without a real trailer. */
export const backupTrailerFor = (genre: string = ""): string => {
  const g = genre.toLowerCase();
  if (g.includes("zombie")) return TRAILERS.facePaint;
  if (g.includes("psycholog") || g.includes("doll")) return TRAILERS.bwForest;
  if (g.includes("haunted") || g.includes("house")) return TRAILERS.cabin;
  if (g.includes("supernatural") || g.includes("ghost")) return TRAILERS.fogWalk;
  return TRAILERS.lightning;
};

/** The original Phantom Veil catalog (posters live in frontend/public/posters). */
export const SEED_MOVIES: SeedMovie[] = [
  { id: "1", title: "The Corridor", poster: "/posters/poster1.jpg", rating: 8.2, duration: "1h 47m", year: 2024, description: "A night shift doctor discovers the hospital's abandoned wing holds something that never left.", genre: "Supernatural Horror", cast: ["Elena Voss", "Marcus Reid", "Suki Tanaka"], trailer: TRAILERS.fogWalk, mediaType: "movie", source: "seed", popularity: 82 },
  { id: "2", title: "Thornfield Manor", poster: "/posters/poster2.jpg", rating: 7.8, duration: "2h 05m", year: 2023, description: "A family inherits a Victorian mansion with a dark history that repeats every full moon.", genre: "Haunted House", cast: ["James Hollow", "Rebecca Crane", "Oliver Marsh"], trailer: TRAILERS.cabin, mediaType: "movie", source: "seed", popularity: 70 },
  { id: "3", title: "The Whisper", poster: "/posters/poster3.jpg", rating: 9.1, duration: "1h 52m", year: 2025, description: "In a remote forest village, a woman's spirit lures travelers into the trees — and they never return.", genre: "Supernatural Horror", cast: ["Yuki Arai", "Daniel Park", "Mina Sato"], trailer: TRAILERS.bwForest, mediaType: "movie", source: "seed", popularity: 95 },
  { id: "4", title: "Dead City Rising", poster: "/posters/poster4.jpg", rating: 7.5, duration: "1h 58m", year: 2024, description: "When the outbreak hits, survivors discover the infected are evolving — and hunting.", genre: "Zombie Apocalypse", cast: ["Rico Vasquez", "Tanya Blake", "Hiro Nakamura"], trailer: TRAILERS.facePaint, mediaType: "movie", source: "seed", popularity: 64 },
  { id: "5", title: "Porcelain", poster: "/posters/poster5.jpg", rating: 8.7, duration: "1h 35m", year: 2024, description: "A collector's antique doll begins moving on its own. By the time she notices, it's too late.", genre: "Psychological Horror", cast: ["Claire Dutton", "Samuel Finch"], trailer: TRAILERS.bwForest, mediaType: "movie", source: "seed", popularity: 88 },
  { id: "6", title: "The Ritual Below", poster: "/posters/poster6.jpg", rating: 8.0, duration: "2h 11m", year: 2023, description: "An archaeologist descends into ancient catacombs and awakens a cult that never died.", genre: "Classic Horror", cast: ["Vincent Rowe", "Nadia Petrov", "Georg Stein"], trailer: TRAILERS.lightning, mediaType: "movie", source: "seed", popularity: 60 },
  { id: "7", title: "Howl", poster: "/posters/poster7.jpg", rating: 7.9, duration: "1h 44m", year: 2025, description: "Under the blood moon, the beast within breaks free — and the hunt begins.", genre: "Supernatural Horror", cast: ["Logan Thorne", "Priya Das", "Erik Wolfe"], trailer: TRAILERS.bwForest, mediaType: "movie", source: "seed", popularity: 76 },
  { id: "8", title: "Ascension", poster: "/posters/poster8.jpg", rating: 8.5, duration: "1h 56m", year: 2024, description: "A priest faces the most terrifying exorcism of his career — one that challenges his faith.", genre: "Supernatural Horror", cast: ["Father Dominic Hale", "Sister Maria", "Dr. Anne Cross"], trailer: TRAILERS.lightning, mediaType: "movie", source: "seed", popularity: 84 },
];

/** Demo community members (non-production by default; see SEED_DEMO_DATA). */
export const DEMO_USERS = [
  { id: "u_demo_nightwatcher", username: "NightWatcher", email: "nightwatcher@phantomveil.app", favoriteGenre: "Supernatural Horror", watchlist: ["3", "1", "8"] },
  { id: "u_demo_graveyardshift", username: "GraveyardShift", email: "graveyardshift@phantomveil.app", favoriteGenre: "Zombie Apocalypse", watchlist: ["4", "6"] },
];

export const DEMO_PASSWORD = "Phantom123";
