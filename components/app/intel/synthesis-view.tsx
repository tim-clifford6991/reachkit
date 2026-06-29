"use client";

/**
 * Synthesis view — the strategic read + prioritization. Built on the intel kit.
 */
import Link from "next/link";
import { useIntel, IntelShell, fmtCompact } from "@/components/app/intel/shared";
import { Card, HeroCard, Eyebrow, Kpi, KpiRow, Badge, Donut, Quadrant, ActionButton, type Segment, type QuadrantItem } from "@/components/app/intel/kit";

interface Content { topic: string; estMonthlyVolume: number; priority: string }
interface Dist { channel: string; action: string; priority: string; ease: number; impact: number }
interface Synthesis { category: string; summary: string; contentPlan: Content[]; distributionPlan: Dist[] }

const PRIO_COLOR: Record<string, string> = { high: "#e5484d", medium: "#e0b341", low: "var(--c-faint)" };
const KIND_COLOR: Record<string, string> = { channel: "var(--c-action)", community: "#46a758", demand: "#e0731c" };
const kindOf = (ch: string) => (ch === "community" ? "community" : ch === "newsletter" || ch === "media" || ch === "podcast" ? "demand" : "channel");

function prioSegs(items: { priority: string }[]): Segment[] {
  const g = items.reduce<Record<string, number>>((a, x) => { a[x.priority] = (a[x.priority] ?? 0) + 1; return a; }, {});
  return ["high", "medium", "low"].filter((k) => g[k]).map((k) => ({ label: k, value: g[k]!, color: PRIO_COLOR[k]! }));
}

export function SynthesisView() {
  const { data, loading, error } = useIntel<Synthesis>("synthesis");
  return (
    <div>      <IntelShell loading={loading} error={error} hasData={!!data}>{data && <Body data={data} />}</IntelShell>
    </div>
  );
}

function Body({ data }: { data: Synthesis }) {
  const { contentPlan, distributionPlan } = data;
  const totalVol = contentPlan.reduce((s, c) => s + c.estMonthlyVolume, 0);
  const high = [...contentPlan, ...distributionPlan].filter((x) => x.priority === "high").length;
  const quad: QuadrantItem[] = distributionPlan.map((d) => ({ ease: d.ease, impact: d.impact, color: KIND_COLOR[kindOf(d.channel)] ?? "var(--c-action)", label: d.action }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <HeroCard>
        <Eyebrow color="var(--c-action)">Strategy · {data.category}</Eyebrow>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-ink)", margin: "6px 0 0" }}>{data.summary}</p>
      </HeroCard>

      <KpiRow>
        <Kpi label="Volume opportunity" value={fmtCompact(totalVol)} sub="monthly searches in reach" />
        <Kpi label="Content pieces" value={contentPlan.length} sub="to write" />
        <Kpi label="Distribution actions" value={distributionPlan.length} sub="channels to work" />
        <Kpi label="High priority" value={high} sub="do these first" />
      </KpiRow>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "300px minmax(0,1fr)" }}>
        <Card title="Priority mix" info="How much of each plan is urgent.">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><Eyebrow>Content</Eyebrow><div style={{ marginTop: 6 }}><Donut segments={prioSegs(contentPlan)} size={104} thickness={13} centerLabel={String(contentPlan.length)} /></div></div>
            <div><Eyebrow>Distribution</Eyebrow><div style={{ marginTop: 6 }}><Donut segments={prioSegs(distributionPlan)} size={104} thickness={13} centerLabel={String(distributionPlan.length)} /></div></div>
          </div>
        </Card>
        <Card title="Focus quadrant" info="Distribution plays on Ease × Impact. Top-right = quick, high-impact wins.">
          {quad.length ? <Quadrant items={quad} legend={[{ color: "var(--c-action)", label: "Channel" }, { color: "#46a758", label: "Community" }, { color: "#e0731c", label: "Media/Demand" }]} /> : <Empty>No distribution plays yet.</Empty>}
        </Card>
      </div>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Digest title="Top content moves" items={contentPlan.slice(0, 4).map((c) => ({ prio: c.priority, label: c.topic, meta: `${fmtCompact(c.estMonthlyVolume)}/mo` }))} />
        <Digest title="Top distribution moves" items={distributionPlan.slice(0, 4).map((c) => ({ prio: c.priority, label: c.action, badge: c.channel }))} />
      </div>

      <ActionButton href="/app/plans">See the full plan →</ActionButton>
    </div>
  );
}

function Digest({ title, items }: { title: string; items: { prio: string; label: string; meta?: string; badge?: string }[] }) {
  return (
    <Card title={title} meta={<Link href="/app/plans" style={{ color: "var(--c-action)", textDecoration: "none" }}>all →</Link>}>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 6, height: 6, borderRadius: "var(--radius-full)", flexShrink: 0, background: PRIO_COLOR[it.prio] }} />
            <span style={{ color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
            {it.meta && <span style={{ marginLeft: "auto", flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>{it.meta}</span>}
            {it.badge && <span style={{ marginLeft: "auto", flexShrink: 0 }}><Badge tone="violet">{it.badge}</Badge></span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>{children}</span>; }
