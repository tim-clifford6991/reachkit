/* @mirrors components/app/intel/competitors-view.tsx */
import * as React from "react";
import { AppShell } from "./AppShell";
import { CompetitorEdgePanel } from "./CompetitorEdgePanel";
import { ChannelDonut } from "./ChannelDonut";
import { SearchGapTable } from "./SearchGapTable";

/**
 * CompetitorsScreen — the in-app Audience → Competitors view
 * (`/app/audience/competitors`): the AppShell chrome wrapping the "how your rivals
 * get found" story. Mirrors `competitors-view.tsx` — a "You vs competitors" score
 * benchmark with the per-rival edge, the referral-channel mix each rival leans on
 * (so the user can copy what works), and the keyword gap. Composes the real
 * primitives — no hand-rolled lookalikes. Renders fully with no props.
 */
export interface CompetitorsScreenProps {
  appName?: string;
}

export function CompetitorsScreen({ appName = "nudgi.ai" }: CompetitorsScreenProps) {
  return (
    <AppShell
      active="audComp"
      headerTitle="Competitors"
      headerSub={`How you & your rivals get found · ${appName}`}
      user={{ name: "Nadia L.", sub: `${appName} · solo founder` }}
    >
      <div style={{ maxWidth: "var(--spacing-content-max)", margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-sans)" }}>
        {/* YOU VS COMPETITORS + edge */}
        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "26px 30px", boxShadow: "var(--elevation-md)" }}>
          <CompetitorEdgePanel
            variant="edge"
            title="You vs. top competitors"
            rows={[
              { name: "YOU", score: 31, isYou: true, scoreColor: "var(--c-band-invisible)" },
              { name: "otter.ai", score: 67 },
              { name: "fireflies.ai", score: 78 },
              { name: "fathom.video", score: 86 },
            ]}
            edge={{ name: "fathom.video", edge: "6× your referring domains", move: "Win back 3 shared directories they're listed in and you're not." }}
          />
        </section>

        {/* HOW RIVALS GET FOUND — referral channel mix */}
        <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--c-ink)", margin: 0 }}>How fathom.video gets found</h3>
            <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>Their top referring channels — the distribution you can copy.</span>
          </div>
          <ChannelDonut
            centerLabel="38% Directories"
            segments={[
              { label: "Software directories", pct: 38, visits: "G2, Capterra, Product Hunt" },
              { label: "Communities", pct: 27, visits: "Reddit, Slack groups" },
              { label: "Press / media", pct: 21, visits: "TechCrunch, The Verge" },
              { label: "Partners", pct: 14, visits: "Zoom, Notion integrations" },
            ]}
          />
        </section>

        {/* KEYWORD GAP */}
        <SearchGapTable />
      </div>
    </AppShell>
  );
}
