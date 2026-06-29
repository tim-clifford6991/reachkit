"use client";

/**
 * Plans view — the actionable payoff: content + distribution plans. Built on the
 * intel kit (Tabs, Card, Badge, Quadrant, Expand, CopyButton).
 */
import { useState } from "react";
import { useIntel, IntelShell, fmt, fmtCompact } from "@/components/app/intel/shared";
import { Card, Kpi, KpiRow, Badge, Quadrant, Expand, CopyButton, EvidenceLink, Tabs, priorityTone, effortTone, type QuadrantItem } from "@/components/app/intel/kit";

interface Content { topic: string; targetKeywords: string[]; estMonthlyVolume: number; format: string; depthTarget: string; buyerAngle: string; competitorExemplars: { domain: string; url: string; position: number }[]; brief: string; agentPrompt: string; priority: string; evidence: string }
interface Dist { channel: string; action: string; target: string; targetUrl: string; why: string; effort: string; priority: string; ease: number; impact: number }
interface Synthesis { contentPlan: Content[]; distributionPlan: Dist[] }

const KIND_COLOR: Record<string, string> = { channel: "var(--c-action)", community: "#46a758", demand: "#e0731c", media: "#3b6fe0" };
const kindOf = (ch: string) => (ch === "community" ? "community" : ch === "newsletter" || ch === "media" || ch === "podcast" ? "demand" : "channel");

export function PlansView() {
  const { data, loading, error, stages } = useIntel<Synthesis>("synthesis");
  return (
    <div>      <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>{data && <Body data={data} />}</IntelShell>
    </div>
  );
}

function Body({ data }: { data: Synthesis }) {
  const { contentPlan, distributionPlan } = data;
  const [tab, setTab] = useState(0);
  const totalVol = contentPlan.reduce((s, c) => s + c.estMonthlyVolume, 0);
  const high = [...contentPlan, ...distributionPlan].filter((x) => x.priority === "high").length;
  const quad: QuadrantItem[] = distributionPlan.map((d) => ({ ease: d.ease, impact: d.impact, color: KIND_COLOR[kindOf(d.channel)] ?? "var(--c-action)", label: d.action }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <KpiRow>
        <Kpi label="Content pieces" value={contentPlan.length} sub="to write" />
        <Kpi label="Distribution actions" value={distributionPlan.length} sub="channels to work" />
        <Kpi label="Volume opportunity" value={fmtCompact(totalVol)} sub="monthly searches in reach" />
        <Kpi label="High priority" value={high} sub="do these first" />
      </KpiRow>

      <Tabs tabs={["Content plan", "Distribution plan"]} active={tab} onChange={setTab} />

      {tab === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {contentPlan.map((c, i) => (
            <Card key={i}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <Badge tone={priorityTone(c.priority)}>{c.priority}</Badge>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--c-ink)" }}>{c.topic}</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>{c.format} · {c.depthTarget} · {fmtCompact(c.estMonthlyVolume)}/mo</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--c-muted)", margin: "8px 0 0" }}><strong style={{ color: "var(--c-ink)" }}>Angle:</strong> {c.buyerAngle}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>{c.targetKeywords.map((k) => <Badge key={k} tone="neutral">{k}</Badge>)}</div>
              {c.competitorExemplars.length > 0 && <div style={{ fontSize: 11.5, color: "var(--c-faint)", marginBottom: 8 }}>Study who wins it: {c.competitorExemplars.map((e) => <span key={e.url} style={{ marginRight: 8 }}><EvidenceLink href={e.url} style={{ fontSize: 11.5 }}>{e.domain} #{e.position}</EvidenceLink></span>)}</div>}
              <Expand label="Open brief">
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55, color: "var(--c-muted)" }}>{c.brief}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 6px" }}><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-faint)" }}>Agent prompt</span><CopyButton text={c.agentPrompt} /></div>
                <pre style={{ maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap", margin: 0, background: "var(--c-dark)", color: "var(--c-on-dark)", borderRadius: "var(--radius-lg)", padding: 12, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.55 }}>{c.agentPrompt}</pre>
                {c.evidence && <div style={{ fontSize: 10, color: "var(--c-faint)", marginTop: 8 }}>evidence: {c.evidence}</div>}
              </Expand>
            </Card>
          ))}
          {contentPlan.length === 0 && <Empty>No content plan generated.</Empty>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {quad.length > 0 && (
            <Card title="Prioritization" info="Each play on Ease × Impact. Top-right = quick, high-impact wins.">
              <Quadrant items={quad} legend={[{ color: "var(--c-action)", label: "Channel" }, { color: "#46a758", label: "Community" }, { color: "#e0731c", label: "Media/Demand" }]} />
            </Card>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {distributionPlan.map((c, i) => (
              <div key={i} style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Badge tone={priorityTone(c.priority)}>{c.priority}</Badge><Badge tone="violet">{c.channel}</Badge>
                  <span style={{ fontWeight: 600, color: "var(--c-ink)" }}>{c.action}</span>
                  <Badge tone={effortTone(c.effort)} style={{ marginLeft: "auto" }}>{c.effort} effort</Badge>
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>{c.targetUrl ? <EvidenceLink href={c.targetUrl}>{c.target}</EvidenceLink> : <span style={{ fontWeight: 600, color: "var(--c-ink)" }}>{c.target}</span>}<span style={{ color: "var(--c-muted)" }}> — {c.why}</span></div>
              </div>
            ))}
            {distributionPlan.length === 0 && <Empty>No distribution plan generated.</Empty>}
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>{children}</span>; }
