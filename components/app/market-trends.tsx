/**
 * MarketTrends — weekly market-snapshot trends (ChannelIntel UX).
 *
 * Renders each `TrendMetric` (share of voice, your vs rival keywords, keyword
 * opportunities, demand pockets) as a labelled shared `Sparkline` with its
 * current value + week-over-week delta. Server-rendered, content-as-props.
 * Renders nothing until there are ≥2 weekly snapshots to trend.
 */

import type { MarketTrend, TrendMetric } from "@/lib/scan/market-trends";
import { DeepSection } from "@/components/report/deep-section-shell";
import { Sparkline } from "@/components/ui/sparkline";

function fmt(v: number, unit: string): string {
  return `${v.toLocaleString()}${unit}`;
}

function Delta({ metric }: { metric: TrendMetric }) {
  if (metric.current === null || metric.previous === null) return null;
  const d = metric.current - metric.previous;
  if (d === 0) {
    return <span className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>±0</span>;
  }
  const up = d > 0;
  return (
    <span className="font-mono text-[10px] tabular-nums" style={{ color: up ? "var(--color-success)" : "var(--color-warning)" }}>
      {up ? "▲" : "▼"} {fmt(Math.abs(d), metric.unit)}
    </span>
  );
}

function TrendRow({ metric }: { metric: TrendMetric }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-4 py-3" style={{ background: "var(--fill-subtle)" }}>
      <div className="min-w-0">
        <p className="text-sm" style={{ color: "var(--color-fg)" }}>{metric.label}</p>
        <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>
          {metric.current !== null ? fmt(metric.current, metric.unit) : "—"}
          <Delta metric={metric} />
        </p>
      </div>
      <Sparkline data={metric.values} width={96} height={28} />
    </div>
  );
}

export function MarketTrends({ trend }: { trend: MarketTrend }) {
  if (trend.metrics.length === 0) return null;
  return (
    <DeepSection id="trends" eyebrow="Market trends" title="How your position is moving">
      <div className="space-y-2">
        {trend.metrics.map((m) => (
          <TrendRow key={m.key} metric={m} />
        ))}
      </div>
    </DeepSection>
  );
}
