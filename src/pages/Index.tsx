import { useState, useCallback } from "react";
import IntroScreen from "@/components/IntroScreen";
import Navbar from "@/components/Navbar";
import HeroGraveyard from "@/components/HeroGraveyard";
import MovieRow from "@/components/MovieRow";
import FogEffect from "@/components/FogEffect";
import { movieCategories } from "@/data/movies";

const Index = () => {
  const [showIntro, setShowIntro] = useState(true);
  const handleIntroComplete = useCallback(() => setShowIntro(false), []);

  return (
    <>
      {showIntro && <IntroScreen onComplete={handleIntroComplete} />}
      <div className="min-h-screen bg-background">
        <Navbar />
        <HeroGraveyard />
        <div className="relative z-10 -mt-20">
          {movieCategories.map(cat => (
            <MovieRow key={cat.title} title={cat.title} movies={cat.movies} />
          ))}
        </div>
        {/* Footer */}
        <footer className="py-12 text-center">
          <p className="font-horror text-xl text-primary text-glow-red">PHANTOM VEIL</p>
          <p className="text-xs text-muted-foreground mt-2 tracking-widest">
            © 2025 Phantom Veil. All rights reserved.
          </p>
        </footer>
        <FogEffect />
      </div>
    </>
  );
};

export default Index;
