/**
 * Sub-genres shared by the home rows, the browse filters and the TMDB import.
 * - `fallback` matches the free-text `genre` of bundled/TVmaze titles.
 * - `keywords` are TMDB keyword names (resolved to ids at import time) and are
 *   also used to tag titles from their detail keywords.
 * - `withGenres` is a TMDB genre AND-combination used instead of keywords.
 */
export interface SubgenreDef {
  key: string;
  label: string;
  fallback: RegExp;
  keywords?: string[];
  withGenres?: string;
  /** Titles released before this year also match (e.g. classics). */
  beforeYear?: number;
  /** Detail keywords that tag a title with this sub-genre. */
  keywordPattern?: RegExp;
}

export const SUBGENRES: SubgenreDef[] = [
  {
    key: "supernatural",
    label: "Supernatural",
    fallback: /supernatural|ghost|paranormal/i,
    keywords: ["supernatural", "ghost", "demon", "possession"],
    keywordPattern: /supernatural|ghost|demon|possess|paranormal|exorcis|witch|occult/i,
  },
  {
    key: "psychological",
    label: "Psychological",
    fallback: /psycholog|thriller|mystery/i,
    withGenres: "27,53",
    keywordPattern: /psycholog|paranoia|madness|insanity|mental illness/i,
  },
  { key: "slasher", label: "Slasher", fallback: /slasher/i, keywords: ["slasher", "serial killer"], keywordPattern: /slasher|serial killer|masked killer/i },
  { key: "zombie", label: "Zombie", fallback: /zombie/i, keywords: ["zombie"], keywordPattern: /zombie|undead/i },
  { key: "haunted-house", label: "Haunted House", fallback: /haunted|house/i, keywords: ["haunted house"], keywordPattern: /haunted house|haunting|haunted/i },
  { key: "classic", label: "Classic (pre-1980)", fallback: /classic/i, beforeYear: 1980 },
];

export const SUBGENRE_KEYS = SUBGENRES.map((s) => s.key) as [string, ...string[]];

export const subgenreByKey = (key: string): SubgenreDef | undefined => SUBGENRES.find((s) => s.key === key);

/** Sub-genre tags implied by a title's TMDB keyword names. */
export const tagsFromKeywords = (names: string[]): string[] =>
  SUBGENRES.filter((s) => s.keywordPattern && names.some((n) => s.keywordPattern!.test(n))).map((s) => s.key);

/** Mongo filter for a sub-genre that works for TMDB tags and fallback free-text genres alike. */
export const subgenreFilter = (key: string): Record<string, unknown> | null => {
  const def = subgenreByKey(key);
  if (!def) return null;
  const or: Record<string, unknown>[] = [{ subgenres: def.key }, { genre: def.fallback }];
  if (def.beforeYear) or.push({ year: { $lt: def.beforeYear } });
  return { $or: or };
};
