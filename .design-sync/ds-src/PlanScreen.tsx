import * as React from "react";
import { AppShell } from "./AppShell";
import { PlanItemCard } from "./PlanItemCard";

/**
 * PlanScreen — the in-app Plan view (`/app/plan`): the AppShell chrome wrapping the
 * singular plan timeline. Mirrors `plan-timeline-view.tsx` — a "Today" summary that
 * splits the load into a quick daily habit vs a focused weekly piece (so it never
 * reads as a ~100-min/day obligation), then the day's action cards. Every card is
 * §11-safe (draft-required, no auto-send) and shows predicted → verified points.
 * Composes PlanItemCard — no hand-rolled lookalikes. Renders fully with no props.
 */
export interface PlanScreenProps {
  appName?: string;
}

const JM = "var(--font-mono)";

export function PlanScreen({ appName = "nudgi.ai" }: PlanScreenProps) {
  return (
    <AppShell
      active="actions"
      headerTitle="Plan"
      headerSub={`Your whole plan on a calendar · ${appName}`}
      user={{ name: "Nadia L.", sub: `${appName} · solo founder` }}
    >
      <div style={{ maxWidth: "var(--spacing-content-max)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-sans)" }}>
        {/* TODAY summary — quick habit vs focused piece */}
        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "18px 22px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--c-ink)", margin: 0 }}>Today</h3>
          <span style={{ fontSize: 13.5, color: "var(--c-muted)" }}>
            <strong style={{ color: "var(--c-ink)" }}>~10 min quick</strong> + <strong style={{ color: "var(--c-ink)" }}>~1 focused piece</strong> — Tuesday, 8 Jul
          </span>
        </section>

        {/* TODAY'S CARDS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PlanItemCard
            title="Post today's build-in-public update on X"
            type="Daily post · 10 min"
            why="Consistent presence compounds — your audience is on X and it's the cheapest channel to stay top-of-mind."
            from="Daily habit"
            predictedPts="+2 pts"
            doFirst
          />
          <PlanItemCard
            title="Publish a comparison page: nudgi vs otter.ai"
            type="Content · focused piece"
            why="Buyers search “otter.ai alternative” — a grounded comparison captures that intent and closes a keyword gap 3 rivals rank for."
            from="Keyword gap vs otter.ai, fireflies.ai"
            predictedPts="+7 pts"
          />
          <PlanItemCard
            title="Submit nudgi.ai to 2 relevant AI directories"
            type="Outreach · 15 min"
            why="Directories your rivals sit in and you don't — fast referral + backlink wins that lift the off-site Market Position."
            from="Channels missing vs fathom.video"
            predictedPts="+4 pts"
            actualPts="+3 pts"
            status="verifying"
            statusColor="var(--c-band-fair)"
          />
        </div>
      </div>
    </AppShell>
  );
}
