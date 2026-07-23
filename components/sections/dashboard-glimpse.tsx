"use client";

/**
 * DashboardGlimpse — a marketing-safe slice of the paid intel dashboard,
 * rendered with the REAL intel-kit components (components/app/intel/kit.tsx)
 * and static fixture data (the bloom.io demo scan from
 * components/report/captured/results-demo.ts). No fetching, no auth — every
 * number is hardcoded demo data and labelled as such.
 *
 * Design idiom: intel kit only — inline styles on --c-* tokens, Space Grotesk /
 * JetBrains Mono, tint chips, the 270° gauge. No Tailwind.
 */

import {
  Gauge,
  Card,
  HeroCard,
  Kpi,
  KpiRow,
  Badge,
  Eyebrow,
  DataTable,
  Bar,
  bandFor,
} from "@/components/app/intel/kit";

const SG = "var(--font-display)";
const JM = "var(--font-mono)";

// Fixture data — the bloom.io demo scan (mirrors results-demo.ts; static, no I/O).
const DEMO = {
  site: "bloom.io",
  score: 47,
  pillars: [
    { label: "Content", value: 56, note: "thin top-funnel" },
    { label: "Outreach", value: 29, note: "biggest lever" },
    { label: "SEO", value: 54, note: "missing schema" },
  ],
  nextAction: {
    title: 'Publish 3 "bloom vs [rival]" comparison pages',
    why: "Captures high-intent buyers comparing you to Habitify & Streaks — queries you don't appear for today.",
    pillar: "Content",
    effort: "Deep",
    pred: 6,
  },
  kpis: [
    { label: "Keyword gaps", value: "34", sub: "queries rivals rank for — you don't" },
    { label: "Ranked actions", value: "7", sub: "3 free in the report, 4 in the paid queue" },
    { label: "Points on the table", value: "+13", sub: "estimated, from the locked queue" },
  ],
  gapRows: [
    { query: "habit tracker vs habitify", volume: "2,400", rank: "Not ranking", ranked: false, opp: "High" },
    { query: "best habit tracker 2026", volume: "8,100", rank: "#42", ranked: true, opp: "High" },
    { query: "free habit tracker template", volume: "3,300", rank: "Not ranking", ranked: false, opp: "High" },
    { query: "habit tracker for adhd", volume: "2,700", rank: "#51", ranked: true, opp: "High" },
  ],
} as const;

export function DashboardGlimpse() {
  const band = bandFor(DEMO.score);

  return (
    <div
      aria-label={`Sample ReachKit dashboard for ${DEMO.site} (demo data)`}
      style={{
        background: "var(--c-bg2)",
        border: "1px solid var(--c-line)",
        borderRadius: "var(--radius-xl)",
        padding: "18px 18px 20px",
      }}
    >
      {/* Frame header — labelled demo, always */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14, padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <Eyebrow>Dashboard</Eyebrow>
          <span style={{ fontFamily: JM, fontSize: 13, fontWeight: 700, color: "var(--c-ink)" }}>{DEMO.site}</span>
        </div>
        <Badge tone="neutral">Sample data — demo scan</Badge>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
        {/* Score + pillar breakdown */}
        <Card title="Discoverability Score" meta="live-page signals">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Gauge score={DEMO.score} size={168} />
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 9 }}>
              {DEMO.pillars.map((p) => (
                <div key={p.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 12.5, color: "var(--c-ink)" }}>{p.label}</span>
                    <span style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-faint)" }}>{p.value} · {p.note}</span>
                  </div>
                  <Bar value={p.value} color={bandFor(p.value).color} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Next best action + KPIs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <HeroCard>
            <Eyebrow color="var(--c-action)">Next best action</Eyebrow>
            <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 16, color: "var(--c-ink)", margin: "8px 0 6px" }}>
              {DEMO.nextAction.title}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--c-muted)", margin: "0 0 12px" }}>{DEMO.nextAction.why}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="violet">{DEMO.nextAction.pillar}</Badge>
              <Badge tone="amber">{DEMO.nextAction.effort}</Badge>
              <Badge tone="green">+{DEMO.nextAction.pred} pts est.</Badge>
            </div>
          </HeroCard>
          <KpiRow>
            {DEMO.kpis.map((k) => (
              <Kpi key={k.label} label={k.label} value={k.value} sub={k.sub} />
            ))}
          </KpiRow>
        </div>
      </div>

      {/* Search-gap table */}
      <div style={{ marginTop: 14 }}>
        <Card title="Search gap" meta={`4 of 34 · band: ${band.label}`}>
          <DataTable
            cols="1.7fr 0.6fr 0.9fr 0.7fr"
            head={["Query", "Volume", "You", "Opportunity"]}
            rows={DEMO.gapRows.map((r) => [
              <span key="q" style={{ fontFamily: JM, fontSize: 12.5 }}>{r.query}</span>,
              <span key="v" style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-muted)" }}>{r.volume}/mo</span>,
              <Badge key="r" tone={r.ranked ? "neutral" : "red"}>{r.rank}</Badge>,
              <Badge key="o" tone="amber">{r.opp}</Badge>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
