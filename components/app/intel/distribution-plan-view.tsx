"use client";

/**
 * Distribution plan view — the outreach half of the synthesis payoff, its own
 * dedicated page (mirrors the Claude Design "Distribution plan" section).
 * Built on the intel kit; shares the `synthesis` layer with SynthesisView /
 * PlansView but focuses solely on `distributionPlan[]`.
 */
import {
  Card, Kpi, KpiRow, Badge, Bar, Quadrant, EvidenceLink,
  priorityTone, effortTone, type QuadrantItem,
} from "@/components/app/intel/kit";
import { useIntel, IntelShell } from "@/components/app/intel/shared";
import type { Synthesis, Dist } from "./synthesis-view";

const CHANNEL_LABEL: Record<string, string> = {
  directory: "Directory", marketplace: "Marketplace", community: "Community",
  media: "Media", podcast: "Podcast", newsletter: "Newsletter", partner: "Partner",
};
const KIND_COLOR: Record<string, string> = { channel: "var(--c-action)", community: "var(--c-band-findable)", demand: "var(--c-band-hard)", media: "#3b6fe0" };
const kindOf = (ch: string) => (ch === "community" ? "community" : ch === "newsletter" || ch === "media" || ch === "podcast" ? "demand" : "channel");

export function DistributionPlanView() {
  const { data, loading, error, stages } = useIntel<Synthesis>("synthesis");
  return (
    <div>
      <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>{data && <DistributionPlanBody data={data} />}</IntelShell>
    </div>
  );
}

export function DistributionPlanBody({ data }: { data: Synthesis }) {
  const { distributionPlan } = data;
  const high = distributionPlan.filter((d) => d.priority === "high").length;
  const avgEase = distributionPlan.length ? distributionPlan.reduce((s, d) => s + d.ease, 0) / distributionPlan.length : 0;
  const quad: QuadrantItem[] = distributionPlan.map((d) => ({ ease: d.ease, impact: d.impact, color: KIND_COLOR[kindOf(d.channel)] ?? "var(--c-action)", label: d.action }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <KpiRow>
        <Kpi label="Distribution actions" value={distributionPlan.length} sub="channels to work" />
        <Kpi label="High priority" value={high} sub="do these first" />
        <Kpi label="Avg. ease" value={`${Math.round(avgEase * 100)}%`} sub="how quick to ship" />
      </KpiRow>

      {quad.length > 0 && (
        <Card title="Ease × impact" info="Each play plotted on Ease × Impact. Top-right = quick, high-impact wins.">
          <Quadrant items={quad} legend={[{ color: KIND_COLOR.channel!, label: "Channel" }, { color: KIND_COLOR.community!, label: "Community" }, { color: KIND_COLOR.demand!, label: "Media/Demand" }]} />
        </Card>
      )}

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {distributionPlan.map((d, i) => <DistCard key={i} d={d} />)}
      </div>
      {distributionPlan.length === 0 && <Empty>No distribution plan generated yet.</Empty>}
    </div>
  );
}

function DistCard({ d }: { d: Dist }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: 16, background: "var(--c-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <Badge tone="violet">{CHANNEL_LABEL[d.channel] ?? d.channel}</Badge>
        <Badge tone={priorityTone(d.priority)}>{d.priority}</Badge>
        <Badge tone={effortTone(d.effort)} style={{ marginLeft: "auto" }}>{d.effort} effort</Badge>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{d.action}</div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        {d.targetUrl ? <EvidenceLink href={d.targetUrl}>{d.target}</EvidenceLink> : <span style={{ fontWeight: 600, color: "var(--c-ink)" }}>{d.target}</span>}
      </div>
      {d.why && <p style={{ fontSize: 13, color: "var(--c-muted)", lineHeight: 1.5, margin: "0 0 8px" }}>{d.why}</p>}
      {d.evidence && <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-faint)", lineHeight: 1.4, margin: "0 0 12px" }}>↳ {d.evidence}</p>}
      <div style={{ display: "flex", gap: 20 }}>
        <Meter label="Ease" value={d.ease} />
        <Meter label="Impact" value={d.impact} />
      </div>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-faint)", marginBottom: 4 }}>
        <span>{label}</span><span>{Math.round(value * 100)}%</span>
      </div>
      <Bar value={value} max={1} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>{children}</span>; }
