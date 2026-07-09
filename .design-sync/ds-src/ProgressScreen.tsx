/* @mirrors components/app/intel/progress-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { ProgressChart } from "./ProgressChart";
import { KpiCard } from "./KpiCard";

/**
 * ProgressScreen — the in-app Progress view (`/app/progress`): the AppShell chrome
 * wrapping the "Discoverability over time" story. Mirrors `progress-view.tsx` — the
 * score trend with verified-fix milestone dots + the streak/current/best KPIs. The
 * trend plots a SINGLE score_version only (a model rebase is never drawn as a real
 * cliff — see engagement.ts scoreHistory). Composes ProgressChart + KpiCard.
 * Renders fully with no props.
 */
export interface ProgressScreenProps {
  appName?: string;
}

export function ProgressScreen({ appName = "nudgi.ai" }: ProgressScreenProps) {
  return (
    <AppShell
      active="history"
      headerTitle="Progress"
      headerSub={`Your Discoverability Score over time · ${appName}`}
      user={{ name: "Nadia L.", sub: `${appName} · solo founder` }}
    >
      <div style={{ maxWidth: "var(--spacing-content-max)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-sans)" }}>
        {/* KPI ROW */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <div style={{ flex: "1 1 180px" }}><KpiCard label="On-site readiness" value="74" delta="+6" deltaDirection="up" note="since last scan" /></div>
          <div style={{ flex: "1 1 180px" }}><KpiCard label="Market position" value="31" delta="+4" deltaDirection="up" note="vs rivals" /></div>
          <div style={{ flex: "1 1 180px" }}><KpiCard label="Weekly streak" value="3 wks" note="fixes shipped" /></div>
        </div>

        {/* TREND */}
        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--c-ink)", margin: 0 }}>Discoverability over time</h3>
            <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>Your on-site readiness at each scan. Dots mark a verified fix that moved the score.</span>
          </div>
          <ProgressChart
            points={[
              { x: 0, y: 52 }, { x: 1, y: 55 }, { x: 2, y: 61 }, { x: 3, y: 62 }, { x: 4, y: 68 }, { x: 5, y: 74 },
            ]}
            markers={[
              { wk: "wk 3", score: 62, x: 3, y: 62 },
              { wk: "wk 5", score: 74, x: 5, y: 74 },
            ]}
            events={[
              { wk: "wk 5", date: "8 Jul", text: "Published otter.ai comparison page" },
              { wk: "wk 3", date: "24 Jun", text: "Added JSON-LD + fixed meta descriptions" },
            ]}
          />
        </section>
      </div>
    </AppShell>
  );
}
