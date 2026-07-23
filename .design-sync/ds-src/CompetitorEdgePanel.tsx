/* @mirrors components/app/intel/competitors-view.tsx */
import * as React from "react";

/**
 * CompetitorEdgePanel — the "Their edge → your move" callout that closes out
 * the Competitors detail panel (below the referrer table, "referrers to
 * pursue", and the top pages/keywords lists). Two shapes, matching the live
 * `CompetitorsBody`:
 *  - `channels` — up to 3 concrete channels the selected rival uses that the
 *    subject doesn't (host + "used by N rivals"), each tagged with a type Badge.
 *  - prose — falls back to a sentence framing the rival's edge (their top gap
 *    keyword, or traffic/backlink framing), with an optional "Counter: … — in
 *    your plan" link when a gap keyword exists. Shown for the subject's own
 *    baseline row too ("Pick a rival above…").
 */
export interface EdgeChannel {
  action: string;
  type: string;
  host: string;
  competitorsUsing: number;
}

export interface CompetitorEdgePanelProps {
  channels?: EdgeChannel[];
  text?: string;
  moveLabel?: string | null;
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--c-band-hard)",
};

export function CompetitorEdgePanel({
  channels = [],
  text = "Pulls 84.2k/mo with referrers like g2.com — study their acquisition mix, then pursue the referrers they have that you don’t (above).",
  moveLabel = null,
}: CompetitorEdgePanelProps) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)", borderTop: "1px solid var(--c-tint-orange-line)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={LABEL_STYLE}>Their edge → your move</span>
      {channels.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {channels.map((c, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.action}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 6px", borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-muted)" }}>{c.type}</span>
              </div>
              <span style={{ fontSize: 11.5, color: "var(--c-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.host} · used by {c.competitorsUsing} rival{c.competitorsUsing === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <span style={{ fontSize: 13, color: "var(--c-ink)", lineHeight: 1.55 }}>{text}</span>
          {moveLabel && (
            <a href="/app/plan" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--c-action)", textDecoration: "none" }}>
              {moveLabel}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </a>
          )}
        </>
      )}
    </div>
  );
}
