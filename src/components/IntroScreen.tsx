import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const IntroScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<"black" | "title" | "tagline" | "exit">("black");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("title"), 800);
    const t2 = setTimeout(() => setPhase("tagline"), 2500);
    const t3 = setTimeout(() => setPhase("exit"), 4500);
    const t4 = setTimeout(onComplete, 5200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  const titleLetters = "PHANTOM VEIL".split("");

  return (
    <AnimatePresence>
      {phase !== "exit" && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-deep-black overflow-hidden"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* Fog layers */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-fog/10 to-transparent animate-fog" />
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-moonlight/5 to-transparent animate-fog-reverse" />
          </div>

          {/* Lightning */}
          <div className="absolute inset-0 bg-moonlight/20 animate-lightning pointer-events-none" />

          {/* Bats */}
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="absolute animate-bat text-foreground/60"
              style={{ animationDelay: `${i * 3}s`, top: `${15 + i * 10}%`, fontSize: "24px" }}
            >
              🦇
            </div>
          ))}

          {/* Title */}
          {(phase === "title" || phase === "tagline") && (
            <motion.h1
              className="font-horror text-6xl md:text-8xl text-primary text-glow-red tracking-widest"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {titleLetters.map((letter, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                  style={{ animation: `glitch 0.5s ease-in-out ${i * 0.08}s, flicker 3s ease-in-out ${i * 0.2}s infinite` }}
                >
                  {letter === " " ? "\u00A0" : letter}
                </motion.span>
              ))}
            </motion.h1>
          )}

          {/* Tagline */}
          {phase === "tagline" && (
            <motion.p
              className="mt-6 text-lg md:text-xl text-fog tracking-[0.3em] font-light"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              Where Every Shadow Tells a Story
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroScreen;
