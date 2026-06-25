import * as React from "react";
import { AppShell } from "./AppShell";
import { KpiCard } from "./KpiCard";
import { RankedFix } from "./RankedFix";

/**
 * DashboardScreen — the in-app dashboard composition: the AppShell chrome wrapping
 * a KPI row and a "this week's fixes" list. Shows how the app primitives compose
 * into a real screen. Renders fully with no props.
 */
export interface DashboardScreenProps {
  appName?: string;
}

export function DashboardScreen({ appName = "nudgi.ai" }: DashboardScreenProps) {
  return (
    <AppShell title="Dashboard" subtitle={`Last scanned 2 days ago · ${appName} · score v3`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: "var(--font-sans)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <KpiCard label="Discoverability score" value="46" delta="+8" deltaDirection="up" note="vs. last scan" />
          <KpiCard label="Fixes shipped" value="5" delta="+2" deltaDirection="up" note="this week" />
          <KpiCard label="Keywords ranking" value="12" delta="−1" deltaDirection="down" note="vs. last scan" />
          <KpiCard label="Weeks tracked" value="6" note="since first scan" />
        </div>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", margin: "0 0 12px", color: "var(--c-ink)" }}>This week&apos;s fixes</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <RankedFix rank={1} title="Add a one-line value proposition above the fold" why="Your hero leads with a feature, not the outcome." effort="Quick win" pillar="Clarity" />
            <RankedFix rank={2} title="Claim the comparison surfaces you're missing" why="Buyers compare on third-party sites you're absent from." effort="Medium" pillar="Outreach" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
