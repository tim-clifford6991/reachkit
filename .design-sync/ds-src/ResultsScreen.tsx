import * as React from "react";
import { ScoreCard } from "./ScoreCard";
import { RankedFix } from "./RankedFix";
import { PositioningMirror } from "./PositioningMirror";
import { SearchGapTable } from "./SearchGapTable";
import { UnlockBand } from "./UnlockBand";

export interface ResultsFix {
  rank: number;
  title: string;
  why: string;
  effort?: "Quick win" | "Medium" | "Long play";
  pillar?: string;
}

/**
 * ResultsScreen — the full free-scan report composition: a report context bar,
 * the ScoreCard hero, the ranked-fixes list, the Positioning Mirror, the Search
 * Gap table, and the unlock band. Composes the report components on the app
 * canvas at the project content width. Renders fully with no props.
 */
export interface ResultsScreenProps {
  siteLabel?: string;
  score?: number;
  headline?: string;
  intro?: string;
  fixes?: ResultsFix[];
}

const H2: React.CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "34px 0 4px", color: "var(--c-ink)" };
const SUB: React.CSSProperties = { fontSize: 14, color: "var(--c-faint)", margin: "0 0 14px" };

export function ResultsScreen({
  siteLabel = "nudgi.ai",
  score = 46,
  headline = "A 46 means real customers are searching — and landing on someone else.",
  intro = "Nudgi is technically fine. The gap is discoverability: you're absent from the comparison and directory surfaces where your buyers decide.",
  fixes = [
    { rank: 1, title: "Add a one-line value proposition above the fold", why: "Your hero leads with a feature, not the outcome.", effort: "Quick win", pillar: "Clarity" },
    { rank: 2, title: "Claim the comparison surfaces you're missing", why: "Buyers compare on third-party sites you're absent from.", effort: "Medium", pillar: "Outreach" },
    { rank: 3, title: "Target the 'gentle habit tracker' query", why: "Low-competition, high-intent, and undefended.", effort: "Long play", pillar: "SEO" },
  ],
}: ResultsScreenProps) {
  return (
    <main style={{ background: "var(--c-bg2)", minHeight: "100vh", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <div style={{ maxWidth: "var(--spacing-content-max)", margin: "0 auto", padding: "32px clamp(24px, 4vw, 48px) 70px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--c-faint)" }}>free scan · {siteLabel}</span>
        </div>
        <ScoreCard score={score} headline={headline} intro={intro} pillars={[{ label: "Content", value: 50, note: "room to climb" }, { label: "Outreach", value: 66, note: "room to climb" }, { label: "SEO", value: 32, note: "biggest lever" }]} />
        <h2 style={H2}>Your top {fixes.length} ranked fixes</h2>
        <p style={SUB}>Ordered by expected score impact.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fixes.map((f) => <RankedFix key={f.rank} {...f} />)}
        </div>
        <h2 style={H2}>Positioning Mirror</h2>
        <p style={SUB}>Who you think you target, vs. who your page actually reads as.</p>
        <PositioningMirror />
        <h2 style={H2}>Search Gap</h2>
        <p style={SUB}>Where real demand exists and you aren't showing up.</p>
        <SearchGapTable />
        <div style={{ marginTop: 32 }}><UnlockBand /></div>
      </div>
    </main>
  );
}
