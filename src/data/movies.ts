import poster1 from "@/assets/posters/poster1.jpg";
import poster2 from "@/assets/posters/poster2.jpg";
import poster3 from "@/assets/posters/poster3.jpg";
import poster4 from "@/assets/posters/poster4.jpg";
import poster5 from "@/assets/posters/poster5.jpg";
import poster6 from "@/assets/posters/poster6.jpg";
import poster7 from "@/assets/posters/poster7.jpg";
import poster8 from "@/assets/posters/poster8.jpg";

export interface Movie {
  id: string;
  title: string;
  poster: string;
  rating: number;
  duration: string;
  year: number;
  description: string;
  genre: string;
  cast: string[];
}

const allMovies: Movie[] = [
  { id: "1", title: "The Corridor", poster: poster1, rating: 8.2, duration: "1h 47m", year: 2024, description: "A night shift doctor discovers the hospital's abandoned wing holds something that never left.", genre: "Supernatural Horror", cast: ["Elena Voss", "Marcus Reid", "Suki Tanaka"] },
  { id: "2", title: "Thornfield Manor", poster: poster2, rating: 7.8, duration: "2h 05m", year: 2023, description: "A family inherits a Victorian mansion with a dark history that repeats every full moon.", genre: "Haunted House", cast: ["James Hollow", "Rebecca Crane", "Oliver Marsh"] },
  { id: "3", title: "The Whisper", poster: poster3, rating: 9.1, duration: "1h 52m", year: 2025, description: "In a remote forest village, a woman's spirit lures travelers into the trees — and they never return.", genre: "Supernatural Horror", cast: ["Yuki Arai", "Daniel Park", "Mina Sato"] },
  { id: "4", title: "Dead City Rising", poster: poster4, rating: 7.5, duration: "1h 58m", year: 2024, description: "When the outbreak hits, survivors discover the infected are evolving — and hunting.", genre: "Zombie Apocalypse", cast: ["Rico Vasquez", "Tanya Blake", "Hiro Nakamura"] },
  { id: "5", title: "Porcelain", poster: poster5, rating: 8.7, duration: "1h 35m", year: 2024, description: "A collector's antique doll begins moving on its own. By the time she notices, it's too late.", genre: "Psychological Horror", cast: ["Claire Dutton", "Samuel Finch"] },
  { id: "6", title: "The Ritual Below", poster: poster6, rating: 8.0, duration: "2h 11m", year: 2023, description: "An archaeologist descends into ancient catacombs and awakens a cult that never died.", genre: "Classic Horror", cast: ["Vincent Rowe", "Nadia Petrov", "Georg Stein"] },
  { id: "7", title: "Howl", poster: poster7, rating: 7.9, duration: "1h 44m", year: 2025, description: "Under the blood moon, the beast within breaks free — and the hunt begins.", genre: "Supernatural Horror", cast: ["Logan Thorne", "Priya Das", "Erik Wolfe"] },
  { id: "8", title: "Ascension", poster: poster8, rating: 8.5, duration: "1h 56m", year: 2024, description: "A priest faces the most terrifying exorcism of his career — one that challenges his faith.", genre: "Supernatural Horror", cast: ["Father Dominic Hale", "Sister Maria", "Dr. Anne Cross"] },
];

export const movieCategories = [
  { title: "Trending Horror", movies: [allMovies[2], allMovies[0], allMovies[4], allMovies[7], allMovies[6], allMovies[1], allMovies[3], allMovies[5]] },
  { title: "New Nightmares", movies: [allMovies[6], allMovies[2], allMovies[0], allMovies[4], allMovies[7], allMovies[3], allMovies[5], allMovies[1]] },
  { title: "Supernatural Horror", movies: [allMovies[2], allMovies[6], allMovies[7], allMovies[0], allMovies[5], allMovies[1], allMovies[4], allMovies[3]] },
  { title: "Psychological Horror", movies: [allMovies[4], allMovies[2], allMovies[7], allMovies[0], allMovies[1], allMovies[5], allMovies[6], allMovies[3]] },
  { title: "Classic Horror", movies: [allMovies[5], allMovies[1], allMovies[0], allMovies[7], allMovies[4], allMovies[2], allMovies[3], allMovies[6]] },
  { title: "Zombie Apocalypse", movies: [allMovies[3], allMovies[6], allMovies[0], allMovies[4], allMovies[1], allMovies[5], allMovies[7], allMovies[2]] },
  { title: "Haunted House", movies: [allMovies[1], allMovies[4], allMovies[5], allMovies[0], allMovies[7], allMovies[2], allMovies[6], allMovies[3]] },
  { title: "Hidden Terrors", movies: [allMovies[7], allMovies[5], allMovies[3], allMovies[4], allMovies[2], allMovies[0], allMovies[1], allMovies[6]] },
];

export const getMovieById = (id: string) => allMovies.find(m => m.id === id);
export const getAllMovies = () => allMovies;
