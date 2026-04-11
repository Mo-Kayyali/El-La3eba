export type RankInfo = {
  name: string;
  /** Tailwind text-color class */
  colorClass: string;
  /** Tailwind box-shadow class for glow effect */
  glowClass: string;
  /** Tailwind border-color class */
  borderClass: string;
};

/**
 * Returns rank info for a given MMR value.
 *
 * Tiers:
 *   0  – 999  : Bronze  (text-orange-400)
 *   1000–1499 : Silver  (text-slate-300)
 *   1500–1999 : Gold    (text-yellow-400)
 *   2000+     : Diamond (text-cyan-400)
 */
export function getRank(mmr: number): RankInfo {
  if (mmr >= 2000) {
    return {
      name: "Diamond",
      colorClass: "text-cyan-400",
      glowClass: "shadow-[0_0_8px_rgba(34,211,238,0.55)]",
      borderClass: "border-cyan-400/30",
    };
  }
  if (mmr >= 1500) {
    return {
      name: "Gold",
      colorClass: "text-yellow-400",
      glowClass: "shadow-[0_0_8px_rgba(250,204,21,0.55)]",
      borderClass: "border-yellow-400/30",
    };
  }
  if (mmr >= 1000) {
    return {
      name: "Silver",
      colorClass: "text-slate-300",
      glowClass: "shadow-[0_0_6px_rgba(203,213,225,0.4)]",
      borderClass: "border-slate-300/25",
    };
  }
  return {
    name: "Bronze",
    colorClass: "text-orange-400",
    glowClass: "shadow-[0_0_6px_rgba(251,146,60,0.45)]",
    borderClass: "border-orange-400/30",
  };
}
