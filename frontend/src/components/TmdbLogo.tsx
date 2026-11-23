/** Compact "TMDB" wordmark used for attribution (text, in TMDB's brand colours). */
const TmdbLogo = ({ className = "" }: { className?: string }) => (
  <span
    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-[#0d253f] ${className}`}
    style={{ background: "linear-gradient(90deg, #90cea1, #01b4e4)", height: "auto" }}
  >
    TMDB
  </span>
);

export default TmdbLogo;
