import * as React from "react";
import { AppShell } from "./AppShell";
import { ScoreGauge } from "./ScoreGauge";
import { CompetitorEdgePanel } from "./CompetitorEdgePanel";
import { ChannelDonut } from "./ChannelDonut";
import { KpiCard } from "./KpiCard";
import { LeverBanner } from "./LeverBanner";
import { SearchGapTable } from "./SearchGapTable";

/**
 * DashboardScreen — the in-app Dashboard view: the AppShell chrome wrapping the
 * canonical dashboard story. Mirrors the live `dashboard-hero.tsx` (score_version 4):
 * the gauge is the ON-SITE READINESS number (stable free↔paid, == the on-site pillar
 * bars), with the off-site MARKET POSITION grade as a separate companion beneath it.
 * Content & SEO are the assessed on-site pillars; Outreach has no on-site signal so it
 * reads "off-site → Market Position". Below the hero: the "You vs competitors"
 * benchmark, the Traffic-by-channel donut + KPI tiles, and the Keyword-gap table.
 * Composes the real report + app primitives — no hand-rolled lookalikes.
 */
export interface DashboardScreenProps {
  appName?: string;
}

const JM = "var(--font-mono)";

/** One on-site pillar bar (mirrors dashboard-hero's rollup rows). */
function PillarRow({ label, value }: { label: string; value: number | null }) {
  const color = value == null ? "var(--c-faint)" : value >= 65 ? "var(--c-band-findable)" : value >= 45 ? "var(--c-band-fair)" : "var(--c-band-invisible)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 76, flexShrink: 0, fontSize: 12.5, color: "var(--c-muted)" }}>{label}</span>
      {value == null ? (
        <span style={{ flex: 1, fontSize: 12, fontStyle: "italic", color: "var(--c-faint)" }}>off-site → Market Position</span>
      ) : (
        <>
          <div style={{ flex: 1, height: 8, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 5, width: `${value}%`, background: color }} />
          </div>
          <span style={{ width: 30, flexShrink: 0, textAlign: "right", fontFamily: JM, fontSize: 13, color: "var(--c-ink)" }}>{value}</span>
        </>
      )}
    </div>
  );
}

export function DashboardScreen({ appName = "nudgi.ai" }: DashboardScreenProps) {
  return (
    <AppShell
      active="dashboard"
      headerTitle="Dashboard"
      headerSub={`Last scanned 2 days ago · ${appName}`}
      user={{ name: "Nadia L.", sub: `${appName} · solo founder` }}
    >
      <div style={{ maxWidth: "var(--spacing-content-max)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-sans)" }}>
        {/* DISCOVERABILITY SCORE — on-site readiness gauge + market position + pillars */}
        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "28px 32px", boxShadow: "var(--elevation-md)", display: "flex", flexDirection: "column", gap: 22 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--c-ink)", margin: 0 }}>Discoverability Score <span style={{ fontFamily: JM, fontSize: 11.5, fontWeight: 500, color: "var(--c-muted)" }}>· Findable</span></h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 34, alignItems: "center" }}>
            {/* Gauge + ON-SITE READINESS caption + Market Position companion */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <ScoreGauge score={74} size={176} showBand={false} />
              <span style={{ fontSize: 10.5, fontFamily: JM, color: "var(--c-faint)", letterSpacing: "0.03em" }}>ON-SITE READINESS</span>
              <span style={{ fontSize: 12, fontFamily: JM, color: "var(--c-band-high)" }}>▲ +6 since last scan</span>
              <div style={{ marginTop: 8, paddingTop: 10, borderTop: "1px dashed var(--c-line)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 10.5, fontFamily: JM, color: "var(--c-faint)", letterSpacing: "0.03em" }}>MARKET POSITION vs RIVALS</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 24, color: "var(--c-band-invisible)" }}>31</span>
                  <span style={{ fontSize: 11, color: "var(--c-faint)" }}>/ 100 · Hard to find</span>
                </div>
                <span style={{ fontSize: 10.5, color: "var(--c-faint)", textAlign: "center", maxWidth: 190, lineHeight: 1.4 }}>Off-site footprint (keywords, backlinks, presence) vs your discovered competitors.</span>
              </div>
            </div>
            {/* On-site pillar bars — the gauge is their weighted average */}
            <div style={{ flex: "1 1 320px", minWidth: 260, display: "flex", flexDirection: "column", gap: 12 }}>
              <PillarRow label="Content" value={68} />
              <PillarRow label="Outreach" value={null} />
              <PillarRow label="SEO" value={78} />
            </div>
          </div>
          <LeverBanner pillar="Content" note="publishing depth on your search-gap themes is the highest-leverage on-site lever right now" points="+7 pts" />
        </section>

        {/* YOU VS COMPETITORS */}
        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "22px 24px" }}>
          <CompetitorEdgePanel
            variant="bars"
            title="You vs. top competitors"
            rows={[
              { name: "YOU", score: 31, isYou: true, scoreColor: "var(--c-band-invisible)" },
              { name: "otter.ai", score: 67 },
              { name: "fireflies.ai", score: 78 },
              { name: "fathom.video", score: 86 },
            ]}
          />
        </section>

        {/* TRAFFIC BY CHANNEL */}
        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--c-ink)", margin: 0 }}>Traffic by channel</h3>
            <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>Where your reach comes from — organic is the largest slice.</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
            <ChannelDonut
              centerLabel="46% Organic"
              segments={[
                { label: "Organic", pct: 46, visits: "1.86k" },
                { label: "Direct / brand", pct: 24, visits: "970" },
                { label: "Referral", pct: 18, visits: "720" },
                { label: "Social", pct: 12, visits: "480" },
              ]}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 180px", minWidth: 180 }}>
              <KpiCard label="Est. visits / mo" value="1.86k" note="" />
              <KpiCard label="Referring domains" value="42" note="" />
            </div>
          </div>
        </section>

        {/* KEYWORD GAP */}
        <SearchGapTable />
      </div>
    </AppShell>
  );
}
