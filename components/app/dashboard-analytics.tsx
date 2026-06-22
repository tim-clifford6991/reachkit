/**
 * DashboardAnalytics — the analytical /app overview (KPI scorecards → hero trend
 * chart + right rail → keyword table), in the Ahrefs/Semrush dashboard grammar
 * scaled to ReachKit's data. Content-as-props so the real dashboard and the dev
 * preview share one composition. The radial gauge stays on the report pages; the
 * dashboard leads with KPIs + the trend.
 */

import type { VerifiedScore } from "@/lib/scan/score-full";
import type { MarketAnalysis } from "@/lib/scan/gap";
import type { ScoreHistoryPoint } from "@/lib/scan/engagement";
import type { HistoryMarker } from "@/lib/scan/score-history-markers";
import type { BreakdownGroup } from "@/lib/scan/signal-breakdown";
import { bandFor } from "@/lib/scan/score-bands";
import { ScoreHistoryCard } from "@/components/app/score-history-card";
import { KeywordGapTable } from "@/components/report/keyword-gap-table";
import { InfoTip } from "@/components/ui/info-tip";
import { EmptyState } from "@/components/ui/empty-state";

// ── KPI scorecards ──────────────────────────────────────────────────────────

interface Kpi {
  label: string;
  value: string;
  accent: string;
  delta?: number | null;
  sub?: string;
}

function KpiTile({ kpi }: { kpi: Kpi }) {
  const showDelta = kpi.delta != null && kpi.delta !== 0;
  const up = (kpi.delta ?? 0) > 0;
  return (
    <div className="flex flex-col gap-1 pt-3" style={{ borderTop: `2px solid ${kpi.accent}` }}>
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
        <span className="size-1.5 rounded-full" style={{ background: kpi.accent }} aria-hidden />
        <InfoTip term={kpi.label} />
      </span>
      <span className="text-2xl font-semibold tabular-nums leading-none" style={{ color: "var(--color-fg)" }}>
        {kpi.value}
      </span>
      <span className="flex items-center gap-2">
        {showDelta && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
            style={{
              background: up ? "color-mix(in oklch, var(--color-success) 14%, transparent)" : "color-mix(in oklch, var(--color-danger) 14%, transparent)",
              color: up ? "var(--color-success)" : "var(--color-danger)",
            }}
          >
            {up ? "▲ +" : "▼ "}
            {Math.abs(kpi.delta ?? 0)}
          </span>
        )}
        {kpi.sub && (
          <span className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>{kpi.sub}</span>
        )}
      </span>
    </div>
  );
}

export interface KpiDeltas {
  organicKeywords?: number | null;
  keywordGaps?: number | null;
  shareOfVoice?: number | null;
}

function buildKpis(
  score: VerifiedScore,
  scoreDelta: number | null,
  breakdown: BreakdownGroup[],
  market: MarketAnalysis | null,
  deltas?: KpiDeltas,
): Kpi[] {
  const band = bandFor(score.total);
  const allSignals = breakdown.flatMap((g) => g.signals);
  const measured = allSignals.filter((s) => s.state !== "unmeasured");
  const passing = measured.filter((s) => s.state === "pass").length;

  const kpis: Kpi[] = [
    { label: "Discoverability", value: `${score.total}`, accent: band.color, delta: scoreDelta, sub: band.label },
  ];
  if (measured.length > 0) {
    kpis.push({ label: "Signals passing", value: `${passing}/${measured.length}`, accent: "var(--color-success)" });
  }
  const seo = market?.cohort.self.seo;
  if (seo?.organicKeywords != null) {
    kpis.push({ label: "Organic keywords", value: seo.organicKeywords.toLocaleString(), accent: "var(--color-accent-400)", delta: deltas?.organicKeywords });
  }
  if (market && market.gap.keywordGap.length > 0) {
    kpis.push({ label: "Keyword gaps", value: market.gap.keywordGap.length.toLocaleString(), accent: "var(--chart-2)", delta: deltas?.keywordGaps });
  }
  const sov = market?.gap.shareOfVoice?.selfPct;
  if (sov != null) {
    kpis.push({ label: "Share of voice", value: `${Math.round(sov * 100)}%`, accent: "var(--chart-3)", delta: deltas?.shareOfVoice });
  }
  return kpis;
}

// ── Right-rail cards ────────────────────────────────────────────────────────

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-5 shadow-[var(--elevation-sm),var(--edge-highlight)]" style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

const PILLAR_COLOR: Record<string, string> = { seo: "var(--color-accent-400)", content: "var(--color-success)", outreach: "var(--chart-3)" };
const STATE_COLOR: Record<string, string> = { pass: "var(--color-success)", warn: "var(--color-warning)", fail: "var(--color-danger)", unmeasured: "var(--color-muted)" };

function OptimizationIdeasCard({ breakdown }: { breakdown: BreakdownGroup[] }) {
  // Segmented bar of pillar contribution + the top non-passing signals (the ideas).
  const pillarTotals = breakdown.map((g) => ({
    pillar: g.pillar,
    contribution: g.signals.reduce((a, s) => a + (s.contribution ?? 0), 0),
  }));
  const sum = pillarTotals.reduce((a, p) => a + p.contribution, 0) || 1;
  const ideas = breakdown
    .flatMap((g) => g.signals)
    .filter((s) => s.state === "fail" || s.state === "warn")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  return (
    <Card title="Optimization ideas">
      <div className="mb-3 flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--fill-subtle)" }}>
        {pillarTotals.map((p) => (
          <span key={p.pillar} style={{ width: `${(p.contribution / sum) * 100}%`, background: PILLAR_COLOR[p.pillar] }} />
        ))}
      </div>
      {ideas.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--color-muted)" }}>No open issues — nicely done.</p>
      ) : (
        <ul className="space-y-2">
          {ideas.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2" style={{ color: "var(--color-fg)" }}>
                <span className="size-2 rounded-full" style={{ background: STATE_COLOR[s.state] }} aria-hidden />
                {s.label}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: STATE_COLOR[s.state] }}>{s.state}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TopSourcesCard({ market }: { market: MarketAnalysis | null }) {
  const pockets = (market?.gap.demandPockets ?? market?.demand?.pockets ?? []).slice(0, 5);
  if (pockets.length === 0) return null;
  const max = Math.max(1, ...pockets.map((p) => p.count));
  return (
    <Card title="Where buyers are">
      <ul className="space-y-2.5">
        {pockets.map((p) => (
          <li key={p.surface} className="flex items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate" style={{ color: "var(--color-fg)" }}>{p.surface}</span>
            <span className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: "var(--fill-subtle)" }}>
              <span className="block h-full rounded-full" style={{ width: `${(p.count / max) * 100}%`, background: "var(--color-accent-400)" }} />
            </span>
            <span className="w-10 text-right font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>{p.count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Composition ─────────────────────────────────────────────────────────────

export function DashboardAnalytics({
  score,
  scoreDelta,
  breakdown,
  market,
  history,
  markers,
  kpiDeltas,
  rankDepth,
  dataAsOf,
}: {
  score: VerifiedScore;
  scoreDelta: number | null;
  breakdown: BreakdownGroup[];
  market: MarketAnalysis | null;
  history: ScoreHistoryPoint[];
  markers?: HistoryMarker[];
  kpiDeltas?: KpiDeltas;
  rankDepth?: number;
  dataAsOf?: string;
}) {
  const kpis = buildKpis(score, scoreDelta, breakdown, market, kpiDeltas);
  const hasMarket = market != null;

  return (
    <div className="space-y-5">
      {/* KPI scorecards */}
      <div className="grid gap-x-6 gap-y-5 rounded-2xl border p-5 shadow-[var(--elevation-sm),var(--edge-highlight)] sm:grid-cols-2 lg:grid-cols-5"
        style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}>
        {kpis.map((k) => (
          <KpiTile key={k.label} kpi={k} />
        ))}
      </div>

      {/* Hero trend + right rail */}
      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <ScoreHistoryCard history={history} markers={markers} />
        </div>
        <div className="space-y-5">
          <TopSourcesCard market={market} />
          {breakdown.length > 0 && <OptimizationIdeasCard breakdown={breakdown} />}
        </div>
      </div>

      {/* Keyword gaps table — positive empty when you're not being out-ranked */}
      {hasMarket &&
        (market.gap.keywordGap.length > 0 ? (
          <Card title="Keyword gaps — rivals rank, you don't">
            <KeywordGapTable rows={market.gap.keywordGap} rankDepth={rankDepth} dataAsOf={dataAsOf} />
          </Card>
        ) : (
          <EmptyState
            tone="positive"
            title="No keyword gaps right now"
            hint="You're matching or beating your rivals on the queries we checked. We'll flag new gaps as they appear."
          />
        ))}
    </div>
  );
}
