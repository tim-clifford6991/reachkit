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
 * canonical dashboard story — a score + "You vs. top competitors" benchmark card
 * (with the weakest-pillar lever banner), the "Traffic by channel" donut paired
 * with its Est. visits/mo + Referring domains KPI tiles, and the "Keyword gap"
 * table. Mirrors the reference template's default (isA/isFull) Dashboard layout:
 * a single centred column of stacked report-style cards. Composes the real report
 * + app primitives — no hand-rolled lookalikes. Renders fully with no props.
 */
export interface DashboardScreenProps {
  appName?: string;
}

export function DashboardScreen({ appName = "nudgi.ai" }: DashboardScreenProps) {
  return (
    <AppShell
      active="dashboard"
      headerTitle="Dashboard"
      headerSub={`Last scanned 2 days ago · ${appName} · score v3`}
      user={{ name: "Nadia L.", sub: `${appName} · solo founder` }}
    >
      <div style={{ maxWidth: "var(--spacing-content-max)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-sans)" }}>
        {/* SCORE + COMPETITOR BENCHMARK */}
        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "28px 32px", boxShadow: "var(--elevation-md)", display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 34 }}>
            <ScoreGauge score={54} size={176} showBand={false} />
            <div style={{ flex: "1 1 440px", minWidth: 0 }}>
              <CompetitorEdgePanel
                variant="bars"
                title="You vs. top competitors"
                rows={[
                  { name: "YOU", score: 54, isYou: true, scoreColor: "var(--c-band-fair)" },
                  { name: "otter.ai", score: 67 },
                  { name: "fireflies.ai", score: 78 },
                  { name: "fathom.video", score: 86 },
                ]}
              />
            </div>
          </div>
          <LeverBanner pillar="Outreach" note="closing the referral & directory gaps is worth the most right now" points="+9 pts" />
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
