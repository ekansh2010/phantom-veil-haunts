import type { WatchProvider, WatchProviders } from "@/data/movies";
import TmdbLogo from "@/components/TmdbLogo";

const GROUPS: Array<{ key: keyof Pick<WatchProviders, "flatrate" | "free" | "ads" | "rent" | "buy">; label: string }> = [
  { key: "flatrate", label: "Stream" },
  { key: "free", label: "Free" },
  { key: "ads", label: "With ads" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
];

const ProviderLogo = ({ p }: { p: WatchProvider }) => (
  <li title={p.name} className="w-12 h-12 rounded-lg overflow-hidden border border-red-950/30 bg-muted/40 flex items-center justify-center">
    {p.logo ? <img src={p.logo} alt={p.name} loading="lazy" className="w-full h-full object-cover" /> : <span className="text-[9px] text-center px-1">{p.name}</span>}
  </li>
);

/** Streaming availability from TMDB (powered by JustWatch), with the attribution both require. */
const WhereToWatch = ({ providers }: { providers: WatchProviders | null }) => {
  const groups = providers ? GROUPS.filter((g) => providers[g.key]?.length) : [];
  return (
    <section aria-labelledby="where-heading">
      <h2 id="where-heading" className="font-horror text-2xl text-primary tracking-wider mb-4">
        Where to Watch
        {providers && <span className="ml-3 text-xs font-sans text-muted-foreground tracking-normal align-middle">Region: {providers.region}</span>}
      </h2>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No streaming, rental or purchase options are listed for this title in your region yet.</p>
      ) : (
        <div className="flex flex-wrap gap-8">
          {groups.map((g) => (
            <div key={g.key}>
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{g.label}</h3>
              <ul className="flex flex-wrap gap-2">
                {providers![g.key].map((p) => (
                  <ProviderLogo key={`${g.key}-${p.id}`} p={p} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
        <span>Availability data from</span>
        <a href={providers?.link || "https://www.themoviedb.org/"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
          <TmdbLogo />
        </a>
        <span>powered by</span>
        <a href="https://www.justwatch.com/" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-primary font-semibold">
          JustWatch
        </a>
      </p>
    </section>
  );
};

export default WhereToWatch;
