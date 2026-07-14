/* @mirrors components/app/intel/plan-entry-card.tsx */
import * as React from "react";

/**
 * PlanItemCard — one entry on the Plan timeline, mirroring the live
 * `PlanEntryCard`'s execute-in-place header + action row. Every card carries
 * TWO badges (colors are the single source of truth in
 * `components/app/intel/plan-kind-style.ts` — reproduced here as plain
 * consts since ds-src can't import from lib/): the KIND (content=violet,
 * distribution=green, post=blue — or the specific channel name when one is
 * known, e.g. "community") and the HORIZON (short="Quick win"=blue,
 * medium="This week"=violet, long="Compounding"=green). Thread-reply
 * distribution entries (a specific existing thread to reply IN, not a venue
 * to submit a new post to) show `openLabel` as "Open in Reddit →" instead of
 * the generic "Draft this post" — this mirror demonstrates that variant.
 */

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";

const KIND_STYLE: Record<"content" | "distribution" | "post", { bg: string; fg: string; label: string }> = {
  content: { bg: "var(--c-soft)", fg: "var(--c-action)", label: "content" },
  distribution: { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)", label: "distribution" },
  post: { bg: "var(--c-tint-blue)", fg: "#3b6fe0", label: "daily post" },
};
const HORIZON_STYLE: Record<"short" | "medium" | "long", { bg: string; fg: string; label: string }> = {
  short: { bg: "var(--c-tint-blue)", fg: KIND_STYLE.post.fg, label: "Quick win" },
  medium: { bg: "var(--c-tint-violet)", fg: "var(--c-action)", label: "This week" },
  long: { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)", label: "Compounding" },
};
const PRIORITY_TONE: Record<string, { bg: string; fg: string }> = {
  high: { bg: "var(--c-tint-red)", fg: "var(--c-band-invisible)" },
  medium: { bg: "var(--c-tint-amber)", fg: "var(--c-band-fair)" },
  low: { bg: "var(--c-fill)", fg: "var(--c-muted)" },
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "var(--c-action)", color: "var(--c-on-dark)",
  fontFamily: PJ, fontWeight: 700, fontSize: 11.5, padding: "6px 12px",
  borderRadius: "var(--radius-full)", border: "none", cursor: "pointer", whiteSpace: "nowrap",
};
const btnGhost: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--c-line)", borderRadius: "var(--radius-full)",
  padding: "4px 12px", fontFamily: PJ, fontSize: 11.5, fontWeight: 600, color: "var(--c-ink)", cursor: "pointer",
};

export interface PlanItemCardProps {
  kind: "content" | "distribution" | "post";
  horizon: "short" | "medium" | "long";
  title: string;
  why?: string;
  /** Shown instead of the generic kind label when a specific channel is known (e.g. "community"). */
  channel?: string;
  effortMin: number;
  priority?: "high" | "medium" | "low";
  /** provenance, e.g. "Outreach gap vs fathom.video". */
  from?: string;
  /** primary execute-button label, e.g. "Open in Reddit →", "Draft the pitch", "Generate draft". */
  openLabel?: string;
  /** e.g. "+9 pts". */
  predictedPts?: string;
  /** verified points once shipped. */
  actualPts?: string;
  doFirst?: boolean;
  status?: string;
  statusColor?: string;
}

export function PlanItemCard(p: PlanItemCardProps) {
  const kindStyle = KIND_STYLE[p.kind];
  const horizonStyle = HORIZON_STYLE[p.horizon];
  const priorityStyle = p.priority ? PRIORITY_TONE[p.priority] : undefined;

  return (
    <div style={{ fontFamily: PJ, color: "var(--c-ink)", border: "1px solid var(--c-line)", borderLeft: `3px solid ${kindStyle.fg}`, borderRadius: "var(--radius-lg)", padding: "16px 16px 16px 14px", background: "var(--c-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        {p.doFirst && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-action)", textTransform: "uppercase", letterSpacing: ".04em" }}>Do this first</span>}
        <span style={{ display: "inline-block", fontFamily: PJ, fontSize: 10.5, fontWeight: 700, color: kindStyle.fg, background: kindStyle.bg, padding: "3px 9px", borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}>
          {p.channel ?? kindStyle.label}
        </span>
        <span style={{ display: "inline-block", fontFamily: PJ, fontSize: 10.5, fontWeight: 700, color: horizonStyle.fg, background: horizonStyle.bg, padding: "3px 9px", borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}>
          {horizonStyle.label}
        </span>
        {priorityStyle && (
          <span style={{ fontSize: 11, fontWeight: 600, color: priorityStyle.fg, background: priorityStyle.bg, padding: "2px 8px", borderRadius: "var(--radius-full)" }}>{p.priority}</span>
        )}
        <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)" }}>~{p.effortMin} min</span>
        {p.status && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--c-on-dark)", background: p.statusColor || "var(--c-action)", padding: "2px 8px", borderRadius: "var(--radius-full)" }}>{p.status}</span>}
      </div>

      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.title}</div>
      {p.why && <p style={{ fontSize: 13, color: "var(--c-muted)", lineHeight: 1.5, margin: "0 0 8px" }}>{p.why}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={btnPrimary}>{p.openLabel ?? "Draft this post"}</button>
        <button type="button" disabled style={{ ...btnGhost, marginLeft: "auto" }}>Mark done</button>
      </div>

      {(p.from || p.predictedPts || p.actualPts) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--c-faint)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--c-line)" }}>
          {p.from && <span>from {p.from}</span>}
          {p.predictedPts && <span style={{ color: "var(--c-action)", fontFamily: JM }}>{p.predictedPts} predicted</span>}
          {p.actualPts && <span style={{ color: "var(--c-band-high)", fontFamily: JM }}>{p.actualPts} verified</span>}
        </div>
      )}
    </div>
  );
}
