/* @mirrors components/app/intel/dashboard-hero.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { Card, Gauge, Bar, Badge, Eyebrow, HeroCard, Donut, KpiRow, Kpi, bandFor } from "./IntelKit";

/**
 * DashboardScreen — the `/app/dashboard` page inside the AppShell: the
 * Discoverability Score hero (gauge + on-site readiness + market position +
 * pillar bars + "your biggest lever"), the score-over-time trend, this week's
 * plan strip, the "you vs competitors" card (ranked bars + channel donut + KPIs),
 * and the keyword-gap table. Composes the shared IntelKit. Mirrors the live
 * dashboard (dashboard-hero + week-plan-preview + dashboard-view).
 */
export interface DashboardScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)", SG = "var(--font-display)";

const PILLARS = [{ label: "Content", value: 56 }, { label: "Outreach", value: 29 }, { label: "SEO", value: 54 }];
const RIVALS = [{ name: "You", score: 47, you: true }, { name: "otter.ai", score: 67 }, { name: "fireflies.ai", score: 78 }, { name: "fathom.video", score: 86 }];
const CHANNELS = [{ label: "Organic", pct: 46, color: "var(--c-action)" }, { label: "Direct / brand", pct: 24, color: "var(--c-band-findable)" }, { label: "Referral", pct: 18, color: "var(--c-band-fair)" }, { label: "Social", pct: 12, color: "var(--c-band-hard)" }];
const GAPS = [
  { kw: "habit tracker vs otter", vol: "2,400", rivals: 3 },
  { kw: "best habit tracker 2026", vol: "8,100", rivals: 4 },
  { kw: "free habit tracker template", vol: "3,300", rivals: 2 },
];
const WEEK = [
  { d: "Mon", chips: [{ c: "var(--c-action)" }] }, { d: "Tue", chips: [{ c: "var(--c-action)" }, { c: "var(--c-band-findable)" }], today: true },
  { d: "Wed", chips: [{ c: "var(--c-action)" }] }, { d: "Thu", chips: [{ c: "var(--c-band-findable)" }] }, { d: "Fri", chips: [{ c: "var(--c-action)" }] },
  { d: "Sat", chips: [] }, { d: "Sun", chips: [] },
];

export function DashboardScreen() {
  return (
    <AppShell active="dashboard" headerTitle="Dashboard" headerSub="Your score, your edge, and this week's highest-leverage move — at a glance." user={{ name: "Nadia L.", sub: "nudgi.ai · solo founder" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Hero */}
        <Card title="Discoverability Score" meta={bandFor(47).label}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" }}>
            <div>
              <Gauge score={47} size={190} />
              <div style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", textAlign: "center", marginTop: 8 }}>ON-SITE READINESS</div>
              <div style={{ fontSize: 12.5, color: "var(--c-band-high)", textAlign: "center", marginTop: 6 }}>▲ +6 since last scan</div>
              <div style={{ borderTop: "1px dashed var(--c-line2)", marginTop: 14, paddingTop: 12, textAlign: "center" }}>
                <Eyebrow>Market position vs rivals</Eyebrow>
                <div style={{ marginTop: 4 }}><span style={{ fontFamily: JM, fontWeight: 700, fontSize: 22, color: "var(--c-band-hard)" }}>31</span><span style={{ fontSize: 13, color: "var(--c-faint)" }}> / 100 · Hard to find</span></div>
                <div style={{ fontSize: 11, color: "var(--c-faint)", fontFamily: JM, maxWidth: 200, margin: "6px auto 0" }}>Off-site footprint (keywords, backlinks, presence) vs your discovered competitors.</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {PILLARS.map((p) => (
                <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 74, fontSize: 13, color: "var(--c-muted)" }}>{p.label}</span>
                  <Bar value={p.value} color={bandFor(p.value).color} />
                  <span style={{ width: 28, textAlign: "right", fontFamily: JM, fontWeight: 700, fontSize: 14, color: bandFor(p.value).color }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
          <HeroCard style={{ marginTop: 20 }}>
            <Eyebrow color="var(--c-action)">Your biggest lever</Eyebrow>
            <p style={{ fontSize: 14, color: "var(--c-ink)", margin: "8px 0 12px", lineHeight: 1.5 }}>Outreach is your lowest-scoring pillar at 29/100. Closing that gap could add ~+9 pts to your score.</p>
            <a href="/app/plan" style={{ display: "inline-block", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13.5, color: "var(--c-on-dark)", background: "var(--c-action)", borderRadius: "var(--radius-lg)", padding: "9px 16px", textDecoration: "none" }}>See your plan →</a>
          </HeroCard>
        </Card>

        {/* Trend */}
        <Card title="Discoverability over time" info="Your Discoverability Score at each scan. Dots mark a verified fix that moved the score.">
          <svg viewBox="0 0 820 200" width="100%" height="180" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="rkTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--c-action)" stopOpacity="0.2" /><stop offset="100%" stopColor="var(--c-action)" stopOpacity="0" /></linearGradient></defs>
            <path d="M0,150 L200,132 L410,110 L620,96 L820,72 L820,200 L0,200 Z" fill="url(#rkTrend)" />
            <path d="M0,150 L200,132 L410,110 L620,96 L820,72" fill="none" stroke="var(--c-action)" strokeWidth="3" />
            {[[200, 132], [620, 96]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="5" fill="var(--c-action)" stroke="var(--c-surface)" strokeWidth="2" />)}
          </svg>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Badge tone="green">✓ Shipped 3 comparison pages</Badge>
            <Badge tone="green">✓ Added FAQ schema</Badge>
          </div>
        </Card>

        {/* Week plan */}
        <Card title="This week's plan" meta={<a href="/app/plan" style={{ color: "var(--c-action)", textDecoration: "none" }}>full 30-day plan →</a>} info="The same rolling plan as your calendar, compressed to this week.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {WEEK.map((d) => (
              <div key={d.d} style={{ border: d.today ? "1.5px solid var(--c-action)" : "1px solid var(--c-line)", background: d.today ? "var(--c-soft)" : "var(--c-surface)", borderRadius: 10, padding: "8px 6px", minHeight: 70 }}>
                <div style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", marginBottom: 6 }}>{d.d}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{d.chips.map((c, i) => <span key={i} style={{ height: 5, borderRadius: 3, background: c.c }} />)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
            <span style={{ fontSize: 13, color: "var(--c-muted)" }}>Today: Guest post on 3 podcast-tool roundups · 1 action · ~20 min</span>
            <a href="/app/plan" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-on-dark)", background: "var(--c-action)", borderRadius: 999, padding: "8px 14px", textDecoration: "none" }}>Open your plan →</a>
          </div>
        </Card>

        {/* You vs competitors */}
        <Card title="You vs. top competitors" meta="#4 of 5" info="Estimated channel mix from public SEO signals. Click a competitor to see their mix.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 24 }}>
            <div>
              <Eyebrow>click to inspect →</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
                {RIVALS.map((r) => (
                  <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10, background: r.you ? "var(--c-soft)" : "transparent", borderRadius: 8, padding: "4px 8px" }}>
                    <span style={{ width: 90, fontSize: 13, fontWeight: r.you ? 700 : 500, color: r.you ? "var(--c-action)" : "var(--c-ink)" }}>{r.name}</span>
                    <Bar value={r.score} color={bandFor(r.score).color} />
                    <span style={{ width: 26, textAlign: "right", fontFamily: JM, fontWeight: 700, fontSize: 13, color: bandFor(r.score).color }}>{r.score}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "var(--c-line)" }} />
            <div>
              <Eyebrow>Your traffic by channel</Eyebrow>
              <div style={{ marginTop: 12 }}><Donut segments={CHANNELS} centerLabel="46%" centerSub="Organic" /></div>
              <div style={{ marginTop: 16 }}><KpiRow><Kpi label="Est. visits / mo" value="1.86k" /><Kpi label="Referring domains" value="42" /></KpiRow></div>
            </div>
          </div>
        </Card>

        {/* Keyword gap */}
        <Card title="Keyword gap" info="High-volume terms rivals rank for that you don't. Expand a row to see who ranks where.">
          <div style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1fr 0.8fr", background: "var(--c-fill)", padding: "10px 14px", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--c-faint)" }}>
              <span>Keyword</span><span>Volume</span><span>Rivals</span><span>Plan</span>
            </div>
            {GAPS.map((g, i) => (
              <div key={g.kw} style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1fr 0.8fr", padding: "11px 14px", borderTop: i === 0 ? "none" : "1px solid var(--c-line2)", alignItems: "center" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{g.kw}</span>
                <span style={{ fontFamily: JM, fontSize: 13, color: "var(--c-muted)" }}>{g.vol}</span>
                <span><Badge tone="amber">{g.rivals} rank it</Badge></span>
                <span style={{ fontSize: 12.5, color: "var(--c-action)", fontWeight: 600, cursor: "pointer" }}>＋ add</span>
              </div>
            ))}
          </div>
          <a href="/app/supply" style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>See all 14 keyword gaps →</a>
        </Card>
      </div>
    </AppShell>
  );
}
