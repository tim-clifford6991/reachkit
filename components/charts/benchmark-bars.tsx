/**
 * BenchmarkBars — you vs the rival median, as paired horizontal bars
 * (ChannelIntel UX). Replaces the text "you: N · rival median: N" rows with a
 * visual comparison. RSC-safe (pure CSS bars, no client boundary).
 */

export interface BenchmarkRow {
  label: string;
  you: number;
  rivalMedian: number;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--fill-subtle)" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function BenchmarkBars({ rows }: { rows: BenchmarkRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const max = Math.max(row.you, row.rivalMedian, 1);
        const ahead = row.you >= row.rivalMedian;
        return (
          <div key={row.label} className="rounded-lg px-4 py-3" style={{ background: "var(--fill-subtle)" }}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-sm" style={{ color: "var(--color-fg)" }}>{row.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: ahead ? "var(--color-success)" : "var(--color-warning)" }}>
                {ahead ? "ahead" : "behind"}
              </span>
            </div>
            <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-3 gap-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>You</span>
              <Bar value={row.you} max={max} color="var(--color-accent-400)" />
              <span className="text-right font-mono text-[11px] tabular-nums" style={{ color: "var(--color-fg)" }}>{row.you.toLocaleString()}</span>

              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Rivals</span>
              <Bar value={row.rivalMedian} max={max} color="var(--color-neutral-400, var(--color-muted))" />
              <span className="text-right font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>{row.rivalMedian.toLocaleString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
