const TIERS = [
  { emoji: "🥉", name: "Bronze", range: "0 – 999", accent: "from-amber-900/40 to-amber-700/10" },
  { emoji: "🥈", name: "Silver", range: "1000 – 1499", accent: "from-slate-500/30 to-slate-400/10" },
  { emoji: "🥇", name: "Gold", range: "1500 – 1999", accent: "from-amber-500/25 to-yellow-500/10" },
  { emoji: "💎", name: "Diamond", range: "2000+", accent: "from-cyan-500/25 to-violet-500/15" },
] as const;

export function RankTierLegend() {
  return (
    <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/25 p-4">
      <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500 mb-3">
        RANK TIERS
      </p>
      <ul className="space-y-2">
        {TIERS.map((t) => (
          <li
            key={t.name}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
          >
            <span className="text-lg shrink-0" aria-hidden>
              {t.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">{t.name}</p>
              <p className="text-[11px] text-slate-400 tabular-nums">{t.range} MMR</p>
            </div>
            <div
              className={`h-10 w-1 shrink-0 rounded-full bg-gradient-to-b ${t.accent}`}
              aria-hidden
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
