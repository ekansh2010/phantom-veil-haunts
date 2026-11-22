import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import graveyardBg from "@/assets/graveyard-bg.jpg";
import track1 from "@/assets/audio/delosound-scary-horror-music-horror.mp3";
import track2 from "@/assets/audio/everything_is_dead-dark-horror.mp3";
import track3 from "@/assets/audio/trenox8-eerie-dark-ambience-for-tension-and-suspense-303395.mp3";



// Minimal music button: icon only. Tracks auto-advance; click to toggle mute.
// Imported so Vite fingerprints and bundles the audio files.
const TRACKS = [track1, track2, track3];

const MusicButton = () => {
  const audioRef  = useRef<HTMLAudioElement>(null);
  const trackRef  = useRef(0);
  const [muted, setMuted]     = useState(false);
  const [started, setStarted] = useState(false);

  // Advance to next track when current ends
  const onEnded = () => {
    trackRef.current = (trackRef.current + 1) % TRACKS.length;
    if (audioRef.current) {
      audioRef.current.src = TRACKS[trackRef.current];
      audioRef.current.play().catch(() => {});
    }
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!started) {
      audio.src = TRACKS[0];
      audio.volume = 0.45;
      audio.play().catch(() => {});
      setStarted(true);
      setMuted(false);
      return;
    }
    if (muted) {
      audio.muted = false;
      setMuted(false);
    } else {
      audio.muted = true;
      setMuted(true);
    }
  };

  return (
    <>
      <audio ref={audioRef} onEnded={onEnded} loop={false} />
      <motion.button
        onClick={toggle}
        className="fixed pointer-events-auto"
        style={{
          bottom: 24,
          right: 24,
          zIndex: 50,
          background: "rgba(10,5,15,0.75)",
          border: "1px solid rgba(180,30,30,0.35)",
          boxShadow: "0 0 15px rgba(180,30,30,0.3)",
          borderRadius: "50%",
          padding: 8,
          cursor: "pointer",
          outline: "none",
          backdropFilter: "blur(6px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        title={!started ? "Play music" : muted ? "Unmute" : "Mute"}
      >
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Speaker cone */}
          <path d="M6 13H11L18 7V29L11 23H6V13Z" fill="rgba(180,60,60,0.85)" />
          {/* Sound waves — shown when active & unmuted */}
          {!muted && started && (
            <>
              <motion.path d="M22 12 Q26 18 22 24" stroke="rgba(200,50,50,0.9)" strokeWidth="1.8" fill="none" strokeLinecap="round"
                animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
              <motion.path d="M25 9 Q31 18 25 27" stroke="rgba(200,50,50,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round"
                animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} />
            </>
          )}
          {/* Muted X lines */}
          {muted && (
            <>
              <line x1="22" y1="13" x2="30" y2="23" stroke="rgba(180,60,60,0.9)" strokeWidth="2" strokeLinecap="round" />
              <line x1="30" y1="13" x2="22" y2="23" stroke="rgba(180,60,60,0.9)" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
          {/* Not started — show a subtle pulse dot */}
          {!started && (
            <motion.circle cx="27" cy="18" r="3" fill="rgba(180,60,60,0.7)"
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </svg>
        {/* Subtle red glow under icon */}
        <motion.div
          style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            boxShadow: muted ? "none" : "0 0 14px 4px rgba(160,0,0,0.35)",
            pointerEvents: "none",
          }}
          animate={!muted && started ? { opacity: [0.5, 1, 0.5] } : { opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.button>
    </>
  );
};

// ════════════════════════════════════════════════════════════════
// 🌧 THUNDERSTORM RAIN — 3 depth layers (bg / mid / fg)
// ════════════════════════════════════════════════════════════════
type RainDrop = { left: number; delay: number; duration: number; opacity: number; height: number; width: number };

const genRain = (count: number, opLo: number, opHi: number, durLo: number, durHi: number, hLo: number, hHi: number): RainDrop[] =>
  Array.from({ length: count }, () => ({
    left:     Math.random() * 110 - 5,
    delay:    Math.random() * 3,
    duration: durLo + Math.random() * (durHi - durLo),
    opacity:  opLo  + Math.random() * (opHi  - opLo),
    height:   hLo   + Math.random() * (hHi   - hLo),
    width:    0.8   + Math.random() * 0.6,
  }));

const RainLayer = ({ drops, blur, slant }: { drops: RainDrop[]; blur: number; slant: number }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9, filter: blur ? `blur(${blur}px)` : undefined }}>
    {drops.map((d, i) => (
      <motion.div key={i}
        style={{
          position: "absolute",
          left: `${d.left}%`,
          top: -d.height,
          width: d.width,
          height: d.height,
          background: `linear-gradient(to bottom, transparent, rgba(160,8,8,${d.opacity * 1.8}))`,
          borderRadius: 2,
          rotate: slant,
        }}
        animate={{ y: ["0vh", "115vh"] }}
        transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: "linear" }}
      />
    ))}
  </div>
);

const ThunderstormRain = () => {
  // Generate once, stable across renders
  const bg  = useRef(genRain(65, 0.05, 0.11, 1.4, 2.2,  55, 95)).current;
  const mid = useRef(genRain(40, 0.11, 0.20, 0.9, 1.5,  75, 125)).current;
  const fg  = useRef(genRain(18, 0.20, 0.36, 0.5, 0.85, 95, 155)).current;
  return (
    <>
      <RainLayer drops={bg}  blur={1.5} slant={-10} />
      <RainLayer drops={mid} blur={0.5} slant={-12} />
      <RainLayer drops={fg}  blur={0}   slant={-14} />
    </>
  );
};

// ════════════════════════════════════════════════════════════════
// 👤 FACE IN THE FOG — barely visible, fleeting
// ════════════════════════════════════════════════════════════════
const FaceInFog = () => (
  <motion.div className="absolute pointer-events-none"
    style={{ left: "36%", bottom: "26%", zIndex: 5, filter: "blur(6px)" }}
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 0, 0, 0.05, 0.09, 0.06, 0.02, 0, 0, 0] }}
    transition={{ duration: 5, repeat: Infinity, repeatDelay: 18, ease: "easeInOut", delay: 10 }}
  >
    <svg width="95" height="115" viewBox="0 0 95 115" fill="none">
      {/* Head */}
      <ellipse cx="47" cy="46" rx="36" ry="42" fill="rgba(215,205,225,0.92)" />
      {/* Neck */}
      <rect x="37" y="84" width="20" height="24" rx="4" fill="rgba(215,205,225,0.92)" />
      {/* Deep hollow eyes */}
      <ellipse cx="32" cy="41" rx="9.5" ry="12" fill="rgba(4,2,8,1)" />
      <ellipse cx="62" cy="41" rx="9.5" ry="12" fill="rgba(4,2,8,1)" />
      {/* Faint eye glow */}
      <ellipse cx="32" cy="41" rx="4"   ry="5"  fill="rgba(70,50,90,0.45)" />
      <ellipse cx="62" cy="41" rx="4"   ry="5"  fill="rgba(70,50,90,0.45)" />
      {/* Nose cavity */}
      <path d="M43,55 L47,65 L51,55Z" fill="rgba(4,2,8,0.85)" />
      {/* Open screaming mouth */}
      <ellipse cx="47" cy="75" rx="13" ry="9" fill="rgba(4,2,8,1)" />
      {/* Gaunt cheek lines */}
      <path d="M14,53 C19,46 28,44 32,48" stroke="rgba(4,2,8,0.25)" strokeWidth="1.5" fill="none" />
      <path d="M80,53 C75,46 66,44 62,48" stroke="rgba(4,2,8,0.25)" strokeWidth="1.5" fill="none" />
      {/* Forehead wrinkles */}
      <path d="M32,22 Q47,18 62,22" stroke="rgba(4,2,8,0.15)" strokeWidth="1" fill="none" />
      <path d="M36,30 Q47,27 58,30" stroke="rgba(4,2,8,0.12)" strokeWidth="0.8" fill="none" />
    </svg>
  </motion.div>
);



// ════════════════════════════════════════════════════════════════
// Existing unchanged sub-components
// ════════════════════════════════════════════════════════════════
const BatSVG = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size * 0.55} viewBox="0 0 60 33" fill="currentColor">
    <ellipse cx="30" cy="18" rx="5" ry="6" fill="#1a0a0a" />
    <path d="M25 18 C18 10, 8 6, 0 14 C6 14, 10 16, 12 20 C16 16, 20 15, 25 18Z" fill="#1a0a0a" />
    <path d="M35 18 C42 10, 52 6, 60 14 C54 14, 50 16, 48 20 C44 16, 40 15, 35 18Z" fill="#1a0a0a" />
    <polygon points="27,12 25,7 29,11" fill="#1a0a0a" />
    <polygon points="33,12 35,7 31,11" fill="#1a0a0a" />
    <circle cx="28" cy="17" r="1.2" fill="#ff2020" />
    <circle cx="32" cy="17" r="1.2" fill="#ff2020" />
  </svg>
);

const AnimatedBat = ({ startX, startY, size, duration, delay }: { startX: number; startY: number; size: number; duration: number; delay: number }) => {
  const flapVariants = { flap: { scaleY: [1, 0.4, 1, 0.5, 1], scaleX: [1, 1.15, 1, 1.1, 1], transition: { duration: 0.35, repeat: Infinity, ease: "easeInOut" as const } } };
  return (
    <motion.div className="absolute pointer-events-none" style={{ left: 0, top: 0, zIndex: 8, color: "rgba(20,5,5,0.85)" }}
      initial={{ x: `${startX}vw`, y: `${startY}vh`, opacity: 0 }}
      animate={{ x: [`${startX}vw`, `${startX + 35}vw`, `${startX + 70}vw`, "110vw"], y: [`${startY}vh`, `${startY - 8}vh`, `${startY + 5}vh`, `${startY - 4}vh`], opacity: [0, 1, 1, 1, 0.7, 0] }}
      transition={{ duration, delay, repeat: Infinity, repeatDelay: 5, ease: "easeInOut", times: [0, 0.3, 0.6, 1] }}
    >
      <motion.div variants={flapVariants} animate="flap"><BatSVG size={size} /></motion.div>
    </motion.div>
  );
};

const Ghost = ({ x, delay, scale = 1 }: { x: string; delay: number; scale?: number }) => (
  <motion.div className="absolute pointer-events-none z-10" style={{ left: x, bottom: "18%", scale }}
    initial={{ y: 0, opacity: 0 }}
    animate={{ y: [0, -18, 0, -10, 0], opacity: [0, 0.18, 0.22, 0.15, 0], x: [0, 6, -4, 8, 0] }}
    transition={{ duration: 9, delay, repeat: Infinity, repeatDelay: 8, ease: "easeInOut" }}
  >
    <div style={{ width: 44, height: 60, background: "radial-gradient(ellipse at 50% 40%, rgba(200,220,255,0.55) 0%, rgba(180,200,255,0.15) 70%, transparent 100%)", borderRadius: "50% 50% 40% 40% / 60% 60% 40% 40%", filter: "blur(3px)", boxShadow: "0 0 24px 6px rgba(180,200,255,0.18)", position: "relative" }}>
      <div style={{ position: "absolute", top: "30%", left: "22%", width: 7, height: 9, background: "rgba(100,120,200,0.7)", borderRadius: "50%", filter: "blur(1px)" }} />
      <div style={{ position: "absolute", top: "30%", right: "22%", width: 7, height: 9, background: "rgba(100,120,200,0.7)", borderRadius: "50%", filter: "blur(1px)" }} />
      <svg width="44" height="14" viewBox="0 0 44 14" style={{ position: "absolute", bottom: -12, left: 0 }}>
        <path d="M0,0 Q5,12 11,6 Q17,0 22,6 Q27,12 33,6 Q39,0 44,6 L44,14 L0,14Z" fill="rgba(200,220,255,0.25)" />
      </svg>
    </div>
  </motion.div>
);

const SkullDecor = ({ x, bottom, size = 22, delay = 0 }: { x: string; bottom: string; size?: number; delay?: number }) => (
  <motion.div
    className="absolute pointer-events-none z-10"
    style={{ 
      left: x, 
      bottom, 
      opacity: 0.4,
      filter: "drop-shadow(0 0 10px rgba(180, 10, 10, 0.55))"
    }}
    animate={{ 
      y: [0, -24, -6, -28, 0],
      x: [0, 4, -4, 3, 0],
      rotate: [-8, 6, -4, 8, -8],
      opacity: [0.25, 0.6, 0.35, 0.65, 0.25]
    }}
    transition={{
      duration: 8 + delay * 1.8,
      repeat: Infinity,
      ease: "easeInOut",
      delay
    }}
  >
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Skull Base */}
      <ellipse cx="20" cy="18" rx="14" ry="13" fill="#9e97a8" />
      <rect x="10" y="27" width="20" height="9" rx="2" fill="#9e97a8" />
      
      {/* Temporal and Cheek Shadows */}
      <ellipse cx="7" cy="18" rx="1.5" ry="3" fill="#05010a" opacity="0.3" />
      <ellipse cx="33" cy="18" rx="1.5" ry="3" fill="#05010a" opacity="0.3" />
      <path d="M8 21 C8 24 10 24 11 24" stroke="#05010a" strokeWidth="0.8" fill="none" opacity="0.4" />
      <path d="M32 21 C32 24 30 24 29 24" stroke="#05010a" strokeWidth="0.8" fill="none" opacity="0.4" />

      {/* Forehead Cracks */}
      <path d="M17 10 Q19 12 18 15" stroke="#05010a" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" />
      <path d="M23 8 Q22 10 24 12" stroke="#05010a" strokeWidth="0.6" strokeLinecap="round" opacity="0.6" />
      
      {/* Eye Sockets */}
      <ellipse cx="14" cy="17" rx="4.5" ry="5" fill="#05010a" />
      <ellipse cx="26" cy="17" rx="4.5" ry="5" fill="#05010a" />
      
      {/* Glowing Crimson Eyes - demonic chaotic flicker */}
      <motion.circle cx="14" cy="17" r="1.6" fill="#ff1100"
        animate={{ 
          opacity: [0.2, 0.8, 0.1, 1, 0.3, 0.9, 0.2],
          scale: [0.8, 1.2, 0.7, 1.3, 0.9, 1.1, 0.8] 
        }}
        transition={{ 
          duration: 2.4, 
          repeat: Infinity, 
          ease: "linear",
          times: [0, 0.15, 0.3, 0.45, 0.65, 0.8, 1],
          delay 
        }}
      />
      <motion.circle cx="26" cy="17" r="1.6" fill="#ff1100"
        animate={{ 
          opacity: [0.2, 0.8, 0.1, 1, 0.3, 0.9, 0.2],
          scale: [0.8, 1.2, 0.7, 1.3, 0.9, 1.1, 0.8] 
        }}
        transition={{ 
          duration: 2.4, 
          repeat: Infinity, 
          ease: "linear",
          times: [0, 0.15, 0.3, 0.45, 0.65, 0.8, 1],
          delay 
        }}
      />

      {/* Nose cavity */}
      <path d="M18 24 L20 21 L22 24Z" fill="#05010a" />

      {/* Teeth slots */}
      <rect x="13" y="27" width="1.5" height="5" rx="0.5" fill="#05010a" />
      <rect x="17" y="27" width="1.5" height="5" rx="0.5" fill="#05010a" />
      <rect x="21" y="27" width="1.5" height="5" rx="0.5" fill="#05010a" />
      <rect x="25" y="27" width="1.5" height="5" rx="0.5" fill="#05010a" />
    </svg>
  </motion.div>
);

const GroundMist = () => (
  <>
    {[0, 1, 2].map(i => (
      <motion.div key={i} className="absolute pointer-events-none"
        style={{ bottom: `${i * 3}%`, left: "-10%", right: "-10%", height: `${80 - i * 18}px`, background: `linear-gradient(to top, rgba(${20 + i * 8},${50 + i * 6},${15 + i * 4},0.${10 + i * 3}) 0%, transparent 100%)`, filter: `blur(${12 + i * 6}px)`, borderRadius: "50%" }}
        animate={{ x: [0, i % 2 === 0 ? 30 : -30, 0], scaleX: [1, 1.05, 0.97, 1] }}
        transition={{ duration: 15 + i * 5, repeat: Infinity, ease: "easeInOut", delay: i * 3 }}
      />
    ))}
  </>
);

const Particle = ({ x, delay, duration }: { x: string; delay: number; duration: number }) => (
  <motion.div className="absolute pointer-events-none"
    style={{ left: x, bottom: "5%", width: 2, height: 2, borderRadius: "50%", background: "rgba(200,200,230,0.7)", zIndex: 7 }}
    initial={{ y: 0, opacity: 0 }}
    animate={{ y: [0, -180, -360], opacity: [0, 0.7, 0.4, 0] }}
    transition={{ duration, delay, repeat: Infinity, ease: "easeOut" }}
  />
);

const CreepyEyes = () => (
  <motion.div className="absolute pointer-events-none" style={{ left: "42%", bottom: "22%", zIndex: 6, display: "flex", gap: 18 }}
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 0, 0.6, 0.8, 0.5, 0] }}
    transition={{ duration: 8, repeat: Infinity, repeatDelay: 14, ease: "easeInOut" }}
  >
    {[0, 1].map(i => (
      <div key={i} style={{ width: 14, height: 20, background: "radial-gradient(ellipse at 50% 50%, #ff1a00 0%, #8b0000 60%, transparent 100%)", borderRadius: "50%", boxShadow: "0 0 18px 6px rgba(200,0,0,0.5), 0 0 40px 10px rgba(140,0,0,0.25)", filter: "blur(0.5px)" }} />
    ))}
  </motion.div>
);

const Cobweb = ({ corner }: { corner: "left" | "right" }) => (
  <div className="absolute top-0 pointer-events-none z-10" style={{ [corner]: 0, transform: corner === "right" ? "scaleX(-1)" : undefined, opacity: 0.35 }}>
    <svg width="130" height="120" viewBox="0 0 130 120" fill="none">
      {[0, 20, 40, 60, 80, 100].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        return <line key={i} x1="0" y1="0" x2={120 * Math.cos(rad)} y2={120 * Math.sin(rad)} stroke="rgba(220,220,230,0.7)" strokeWidth="0.8" />;
      })}
      {[25, 50, 75, 100].map((r, i) => <path key={i} d={`M ${r} 0 Q ${r * 0.7} ${r * 0.7} 0 ${r}`} stroke="rgba(220,220,230,0.5)" strokeWidth="0.7" fill="none" />)}
      {[35, 60, 85, 110].map((r, i) => <path key={`b${i}`} d={`M ${r * 0.85} 0 Q ${r * 0.6} ${r * 0.55} 0 ${r * 0.85}`} stroke="rgba(200,200,220,0.35)" strokeWidth="0.6" fill="none" />)}
      <circle cx="22" cy="22" r="3" fill="rgba(30,20,20,0.8)" />
      <line x1="19" y1="22" x2="13" y2="25" stroke="rgba(30,20,20,0.8)" strokeWidth="0.8" />
      <line x1="19" y1="22" x2="12" y2="20" stroke="rgba(30,20,20,0.8)" strokeWidth="0.8" />
      <line x1="25" y1="22" x2="31" y2="25" stroke="rgba(30,20,20,0.8)" strokeWidth="0.8" />
      <line x1="25" y1="22" x2="32" y2="20" stroke="rgba(30,20,20,0.8)" strokeWidth="0.8" />
    </svg>
  </div>
);

const Tombstones = ({ scrollY }: { scrollY: number }) => (
  <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ zIndex: 5, transform: `translateY(${scrollY * 0.1}px)` }}>
    {[{ w: 50, h: 70, rx: 25, x: "5%" }, { w: 38, h: 55, rx: 19, x: "15%" }, { w: 56, h: 85, rx: 28, x: "25%" }, { w: 42, h: 62, rx: 21, x: "72%" }, { w: 60, h: 90, rx: 30, x: "82%" }, { w: 36, h: 50, rx: 18, x: "92%" }].map((t, i) => (
      <div key={i} className="absolute bottom-0" style={{ left: t.x, opacity: 0.45 }}>
        <svg width={t.w} height={t.h} viewBox={`0 0 ${t.w} ${t.h}`}>
          <rect x="0" y={t.rx} width={t.w} height={t.h - t.rx} rx="3" fill="#0d0608" />
          <ellipse cx={t.w / 2} cy={t.rx} rx={t.w / 2} ry={t.rx} fill="#0d0608" />
          <line x1={t.w / 2 - 8} y1={t.h * 0.5} x2={t.w / 2 + 8} y2={t.h * 0.5} stroke="#1a0a10" strokeWidth="1.5" opacity="0.5" />
          <line x1={t.w / 2} y1={t.h * 0.4} x2={t.w / 2} y2={t.h * 0.65} stroke="#1a0a10" strokeWidth="1.5" opacity="0.5" />
        </svg>
      </div>
    ))}
  </div>
);

const LightningLayer = ({ delay, duration }: { delay: number; duration: number }) => (
  <motion.div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}
    initial={{ opacity: 0 }}
    animate={{ opacity: [0, 0, 0, 0.18, 0.05, 0.22, 0] }}
    transition={{ duration: 0.5, delay, repeat: Infinity, repeatDelay: duration, ease: "easeOut" }}
  >
    <div className="absolute inset-0" style={{ background: "rgba(240,165,165,0.85)" }} />
  </motion.div>
);



// ════════════════════════════════════════════════════════════════
// 🏚 MAIN HERO
// ════════════════════════════════════════════════════════════════
const HeroGraveyard = ({ onEnterHorror }: { onEnterHorror?: () => void }) => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const bats = [
    { startX: -5, startY: 12, size: 32, duration: 14, delay: 0  },
    { startX: -5, startY: 22, size: 22, duration: 18, delay: 5  },
    { startX: -5, startY: 8,  size: 28, duration: 12, delay: 9  },
    { startX: -5, startY: 18, size: 18, duration: 20, delay: 14 },
  ];

  const particles = Array.from({ length: 14 }, (_, i) => ({
    x: `${(i / 14) * 90 + 5}%`,
    delay: i * 0.85,
    duration: 12 + (i % 5) * 2,
  }));

  return (
    <section className="relative h-screen overflow-hidden" style={{ background: "#050208" }}>

        {/* Parallax background */}
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${graveyardBg})`, transform: `translateY(${scrollY * 0.3}px) scale(1.12)`, filter: "brightness(0.28) saturate(0.5)" }}
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/30" />
        {/* Cinematic Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_25%,rgba(5,2,10,0.85)_100%)] z-10" />

        {/* Cobwebs */}
        <Cobweb corner="left" />
        <Cobweb corner="right" />

        {/* Lightning */}
        <LightningLayer delay={3}   duration={11} />
        <LightningLayer delay={7.5} duration={15} />

        {/* Rain — 3 depth layers */}
        <ThunderstormRain />

        {/* Fog */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(180,190,220,0.08) 0%, transparent 100%)", filter: "blur(10px)", animation: "fogDrift 18s ease-in-out infinite alternate" }} />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(160,170,210,0.06) 0%, transparent 100%)", filter: "blur(14px)", animation: "fogDrift 25s ease-in-out infinite alternate-reverse" }} />
        <div className="absolute bottom-0 left-0 right-0 h-1/4 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(140,150,200,0.10) 0%, transparent 100%)", filter: "blur(6px)", animation: "fogDrift 12s ease-in-out infinite alternate" }} />

        {/* Face in the fog */}
        <FaceInFog />

        {/* Tombstones */}
        <Tombstones scrollY={scrollY} />

        {/* Ground mist */}
        <GroundMist />

        {/* Skull decor */}
        <SkullDecor x="3%"  bottom="8%" size={26} delay={0} />
        <SkullDecor x="10%" bottom="7%" size={18} delay={2} />
        <SkullDecor x="85%" bottom="8%" size={24} delay={1} />
        <SkullDecor x="92%" bottom="7%" size={20} delay={3} />
        <SkullDecor x="47%" bottom="5%" size={16} delay={4} />

        {/* Ghosts */}
        <Ghost x="12%" delay={2}  scale={0.9}  />
        <Ghost x="55%" delay={6}  scale={1.1}  />
        <Ghost x="80%" delay={11} scale={0.75} />

        {/* Creepy eyes */}
        <CreepyEyes />

        {/* Bats */}
        {bats.map((b, i) => <AnimatedBat key={i} {...b} />)}

        {/* Dust particles */}
        {particles.map((p, i) => <Particle key={i} {...p} />)}

        {/* ── CENTER CONTENT ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className="relative">
            <motion.h1
              className="font-blood text-5xl md:text-8xl tracking-widest select-none"
              style={{ color: "#cc0000", textShadow: "0 0 30px rgba(200,0,0,0.8), 0 0 60px rgba(150,0,0,0.5), 0 0 100px rgba(100,0,0,0.3)", letterSpacing: "0.14em" }}
              initial={{ opacity: 0, scale: 0.8, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0, textShadow: ["0 0 30px rgba(200,0,0,0.8), 0 0 60px rgba(150,0,0,0.5)", "0 0 50px rgba(220,0,0,1), 0 0 90px rgba(180,0,0,0.7)", "0 0 30px rgba(200,0,0,0.8), 0 0 60px rgba(150,0,0,0.5)"] }}
              transition={{ opacity: { duration: 1, delay: 0.3 }, scale: { duration: 1, delay: 0.3 }, y: { duration: 1, delay: 0.3 }, textShadow: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 } }}
              whileHover={{ letterSpacing: "0.22em", transition: { duration: 0.4 } }}
            >
              PHANTOM VEIL
            </motion.h1>
          </div>

          <motion.p
            className="mt-6 text-xs md:text-sm tracking-[0.35em] font-typewriter text-primary text-glow-red select-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
          >
            where every shadow tells a story
          </motion.p>

          <motion.button
            onClick={onEnterHorror}
            className="mt-10 px-10 py-4 font-horror text-lg tracking-widest rounded-lg relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #1a0000 0%, #3d0000 50%, #1a0000 100%)", border: "1px solid rgba(180,0,0,0.5)", color: "#ff4444", textShadow: "0 0 10px rgba(255,50,50,0.6)", boxShadow: "0 0 20px rgba(150,0,0,0.4), inset 0 0 20px rgba(100,0,0,0.2)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
            whileHover={{ scale: 1.06, boxShadow: "0 0 40px rgba(200,0,0,0.6), 0 0 80px rgba(150,0,0,0.3), inset 0 0 30px rgba(120,0,0,0.3)" }}
            whileTap={{ scale: 0.96 }}
          >
            <motion.div className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,50,50,0.08) 50%, transparent 100%)" }}
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
            />
            ENTER THE HORROR
          </motion.button>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 cursor-pointer z-20"
          onClick={onEnterHorror}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-1"
          >
            <span className="text-[10px] tracking-[0.4em] text-muted-foreground uppercase select-none">
              Scroll into the Veil
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary text-glow-red">
              <path d="M7 13L12 18L17 13" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 6L12 11L17 6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
            </svg>
          </motion.div>
        </motion.div>

        {/* Sound toggle icon */}
        <MusicButton />

        {/* Keyframes */}
        <style>{`
          @keyframes fogDrift {
            0%   { transform: translateX(-3%) scaleX(1.02); }
            100% { transform: translateX(3%)  scaleX(0.98); }
          }
        `}</style>
      </section>
  );
};

export default HeroGraveyard;