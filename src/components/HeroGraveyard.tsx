import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import graveyardBg from "@/assets/graveyard-bg.jpg";

const HeroGraveyard = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative h-screen overflow-hidden">
      {/* Parallax background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${graveyardBg})`,
          transform: `translateY(${scrollY * 0.3}px) scale(1.1)`,
        }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />

      {/* Fog */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-fog/10 to-transparent animate-fog pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-moonlight/5 to-transparent animate-fog-reverse pointer-events-none" />

      {/* Lightning flash */}
      <div className="absolute inset-0 bg-moonlight/10 animate-lightning pointer-events-none" />

      {/* Bats */}
      {[0, 1].map(i => (
        <div
          key={i}
          className="absolute animate-bat text-foreground/40"
          style={{ animationDelay: `${i * 5}s`, top: `${10 + i * 8}%`, fontSize: "20px" }}
        >
          🦇
        </div>
      ))}

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <motion.h1
          className="font-horror text-6xl md:text-9xl text-primary text-glow-red tracking-widest"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          PHANTOM VEIL
        </motion.h1>

        <motion.p
          className="mt-4 text-fog text-sm md:text-lg tracking-[0.4em]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          Where Every Shadow Tells a Story
        </motion.p>

        <motion.button
          className="mt-10 px-10 py-4 font-horror text-lg tracking-widest text-primary-foreground btn-horror rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          ENTER THE VEIL
        </motion.button>
      </div>
    </section>
  );
};

export default HeroGraveyard;
