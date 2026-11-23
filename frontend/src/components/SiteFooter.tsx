import { Link } from "react-router-dom";
import TmdbLogo from "@/components/TmdbLogo";

/** Site-wide footer, including the TMDB attribution required by its API terms. */
const SiteFooter = () => (
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
          <li><Link to="/browse" className="hover:text-primary transition-colors">Haunted Catalog</Link></li>
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
      <div className="mt-4 flex flex-col items-center gap-2 text-[11px] text-muted-foreground/80">
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" aria-label="The Movie Database (TMDB)">
          <TmdbLogo />
        </a>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
