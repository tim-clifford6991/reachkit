"use client";

/**
 * Content plan view — the "what to write" half of the synthesis plan. Mirrors
 * the Claude Design template's Content-plan section (planGroups / PlanItemCard
 * idiom): items grouped by priority, each card showing format, topic, the
 * buyer-angle "why", provenance (keyword/competitor it's grounded in),
 * predicted monthly volume, and a "Do this first" emphasis on the top pick.
 * Built strictly on the intel kit (--c-* tokens, no foreign components).
 */
import { useIntel, IntelShell, fmtCompact } from "@/components/app/intel/shared";
import { Card, Kpi, KpiRow, Badge, EvidenceLink, ActionButton, priorityTone } from "@/components/app/intel/kit";
import type { Synthesis, Content } from "@/components/app/intel/synthesis-view";

const PRIO_COLOR: Record<string, string> = { high: "#e5484d", medium: "#e0b341", low: "var(--c-faint)" };
const PRIO_LABEL: Record<string, string> = { high: "High priority", medium: "Medium priority", low: "Low priority" };

export function ContentPlanView() {
  const { data, loading, error, stages } = useIntel<Synthesis>("synthesis");
  return (
    <div>
      <IntelShell loading={loading} error={error} hasData={!!data} stages={stages}>{data && <ContentPlanBody data={data} />}</IntelShell>
    </div>
  );
}

export function ContentPlanBody({ data }: { data: Synthesis }) {
  const { contentPlan } = data;
  const totalVol = contentPlan.reduce((s, c) => s + c.estMonthlyVolume, 0);
  const high = contentPlan.filter((c) => c.priority === "high").length;

  const groups = (["high", "medium", "low"] as const)
    .map((p) => ({
      key: p,
      label: PRIO_LABEL[p]!,
      color: PRIO_COLOR[p]!,
      items: contentPlan.filter((c) => c.priority === p).slice().sort((a, b) => b.estMonthlyVolume - a.estMonthlyVolume),
    }))
    .filter((g) => g.items.length > 0);

  const doFirst = groups.find((g) => g.key === "high")?.items[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "18px 22px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--c-ink)" }}>Content plan</span>
          <span style={{ fontSize: 13, color: "var(--c-muted)" }}>Synthesized from supply × demand · {contentPlan.length} {contentPlan.length === 1 ? "item" : "items"}</span>
        </div>
        <ActionButton href="/app/plan/distribution">Distribution plan →</ActionButton>
      </div>

      <KpiRow>
        <Kpi label="Content pieces" value={contentPlan.length} sub="to write" />
        <Kpi label="Volume opportunity" value={fmtCompact(totalVol)} sub="monthly searches in reach" />
        <Kpi label="High priority" value={high} sub="do these first" />
      </KpiRow>

      {contentPlan.length === 0 ? (
        <Card><Empty>No content plan generated yet.</Empty></Card>
      ) : (
        groups.map((g) => (
          <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 2px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", flexShrink: 0, background: g.color }} />
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--c-ink)", margin: 0 }}>{g.label}</h3>
              <span style={{ fontSize: 12, color: "var(--c-faint)" }}>{g.items.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 11 }}>
              {g.items.map((c, i) => <ContentCard key={`${c.topic}-${i}`} c={c} doFirst={c === doFirst} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ContentCard({ c, doFirst }: { c: Content; doFirst: boolean }) {
  const kw = c.targetKeywords?.[0];
  const ex = c.competitorExemplars?.[0];
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", background: "var(--c-surface)", border: `1px solid ${doFirst ? "var(--c-action)" : "var(--c-line)"}`, borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <Badge tone="violet">{c.format}</Badge>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, color: "var(--c-ink)" }}>{c.topic}</span>
          {doFirst && <Badge tone="orange">Do this first</Badge>}
        </div>
        {c.buyerAngle && <span style={{ fontSize: 12.5, color: "var(--c-muted)", lineHeight: 1.5 }}>{c.buyerAngle}</span>}
        {ex ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-action)", marginTop: 2 }}>
            ↳ {kw ?? c.format} · <EvidenceLink href={ex.url} style={{ fontSize: 10.5 }}>{ex.domain} ranks #{ex.position}</EvidenceLink>
          </span>
        ) : kw ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-action)", marginTop: 2 }}>↳ keyword gap: {kw}</span>
        ) : c.evidence ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-faint)", marginTop: 2 }}>↳ {c.evidence}</span>
        ) : null}
      </div>
      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <Badge tone={priorityTone(c.priority)}>{c.priority}</Badge>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-faint)" }}>{fmtCompact(c.estMonthlyVolume)}/mo predicted</span>
        {c.depthTarget && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--c-faint)" }}>{c.depthTarget}</span>}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <span style={{ fontSize: 13, color: "var(--c-faint)" }}>{children}</span>; }
