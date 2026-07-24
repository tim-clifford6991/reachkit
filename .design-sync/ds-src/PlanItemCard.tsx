/* @mirrors components/app/intel/plan-entry-card.tsx */
import * as React from "react";

/**
 * PlanItemCard — one entry on the Plan timeline, mirroring the live
 * `PlanEntryCard`'s execute-in-place header + action row + its "details →"
 * popup. Every card carries TWO badges (colors are the single source of truth
 * in `components/app/intel/plan-kind-style.ts` — reproduced here as plain
 * consts since ds-src can't import from lib/): the KIND (content=violet,
 * distribution=green, post=blue — or the specific channel name when one is
 * known, e.g. "community") and the HORIZON (short="Quick win"=blue,
 * medium="This week"=violet, long="Compounding"=green). Thread-reply
 * distribution entries (a specific existing thread to reply IN, not a venue
 * to submit a new post to) show `openLabel` as "Open in Reddit →" instead of
 * the generic "Draft this post" — this mirror demonstrates that variant.
 *
 * The provenance line's "details →" opens the live entry's analysis modal
 * (DetailSections), whose field labels differ per kind. In the live app each
 * entry opens ONE modal showing only its own kind's section; ds-src can't drive
 * a modal, so below the prop-driven card we render the three per-kind detail
 * panels inline as a showcase — content (Keywords / Format / Brief / Who wins
 * it / Evidence / Agent prompt), distribution (Where / Evidence / Ease /
 * Impact), post (How it works / Coming up) — so every field caption the popup
 * can render is mirrored. These captions are modal-gated + kind-gated in live
 * (see report), exposed here as always-open samples.
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
      {p.why && <p style={{ fontSize: 13, color: "var(--c-muted)", lineHeight: 1.5, margin: "0 0 6px" }}>{p.why}</p>}
      {/* N (2026-07-24): grounding — what the action targets + who it models. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", margin: "0 0 8px" }}>
        <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-muted)", overflowWrap: "anywhere" }}><b style={{ color: "var(--c-faint)", fontWeight: 700, letterSpacing: "0.04em" }}>TARGETS </b>cookieless analytics, gdpr analytics</span>
        <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-muted)", overflowWrap: "anywhere" }}><b style={{ color: "var(--c-faint)", fontWeight: 700, letterSpacing: "0.04em" }}>MODELED ON </b>matomo.org</span>
      </div>

      {/* Provenance — cites evidence and opens the entry's full analysis in
          place ("details →" / "what to post about →" for daily posts). */}
      <p style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", lineHeight: 1.5, margin: "0 0 8px" }}>
        {p.from && <>↳ {p.from}{" · "}</>}
        <span style={{ color: "var(--c-action)", fontWeight: 700 }}>{p.kind === "post" ? "what to post about →" : "details →"}</span>
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={btnPrimary}>{p.openLabel ?? "Draft this post"}</button>
        <button type="button" disabled style={{ ...btnGhost, marginLeft: "auto" }}>Mark done</button>
      </div>

      {(p.predictedPts || p.actualPts) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--c-faint)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--c-line)" }}>
          {p.predictedPts && <span style={{ color: "var(--c-action)", fontFamily: JM }}>{p.predictedPts} predicted</span>}
          {p.actualPts && <span style={{ color: "var(--c-band-high)", fontFamily: JM }}>{p.actualPts} verified</span>}
        </div>
      )}

      {/* Detail-popup showcase — the three per-kind analysis panels the live
          "details →" modal renders (one kind per real entry). */}
      <DetailShowcase />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail sections — mirror of the live DetailSections modal body, per kind.
// ---------------------------------------------------------------------------

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
      <span style={{ flexShrink: 0, width: 92, fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</span>
      <span style={{ minWidth: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--c-ink)" }}>{children}</span>
    </div>
  );
}

function MeterRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, minWidth: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", marginBottom: 4 }}>
        <span>{label}</span><span>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--c-fill)", overflow: "hidden" }}>
        <div style={{ width: `${Math.round(value * 100)}%`, height: "100%", background: "var(--c-action)" }} />
      </div>
    </div>
  );
}

function DetailPanel({ kind, title, children }: { kind: "content" | "distribution" | "post"; title: string; children: React.ReactNode }) {
  const k = KIND_STYLE[kind];
  return (
    <div style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)", background: "var(--c-surface)", padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: PJ, fontSize: 10.5, fontWeight: 700, color: k.fg, background: k.bg, padding: "3px 9px", borderRadius: "var(--radius-full)" }}>{k.label}</span>
        <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 13, color: "var(--c-ink)" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{children}</div>
    </div>
  );
}

function DetailShowcase() {
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--c-line)", display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontFamily: JM, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)" }}>details → popup</span>

      <DetailPanel kind="content" title="nudgi vs otter.ai: which fits solo founders">
        <DetailRow label="Keywords">
          otter.ai alternative, ai notetaker for founders
          <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-action)" }}> · ~1.1k/mo</span>
        </DetailRow>
        <DetailRow label="Format">Comparison · 1,500+ words</DetailRow>
        <DetailRow label="Brief">Position nudgi as the solo-founder pick — pricing, Zoom coverage, and the manual-cleanup pain otter.ai leaves behind.</DetailRow>
        <DetailRow label="Who wins it">
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12, color: "var(--c-action)" }}>otter.ai ranks #2</span>
            <span style={{ fontSize: 12, color: "var(--c-action)" }}>fireflies.ai ranks #5</span>
          </span>
        </DetailRow>
        <DetailRow label="Evidence">otter.ai holds position 2 for “otter.ai alternative”; you have no comparison page yet.</DetailRow>
        <DetailRow label="Agent prompt">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-muted)" }}>ready-to-run writing prompt</span>
            <span style={{ ...btnGhost, padding: "2px 10px", fontSize: 10.5 }}>Copy</span>
          </span>
        </DetailRow>
        {/* N+ (2026-07-24): every detail modal ends with a consistent strategic line. */}
        <DetailRow label="How it helps">Builds your own-site authority for keywords rivals already win — the compounding half of discoverability.</DetailRow>
      </DetailPanel>

      <DetailPanel kind="distribution" title='List on "Best AI Meeting Assistants 2026"'>
        <DetailRow label="Where">
          <span style={{ color: "var(--c-action)", fontWeight: 600 }}>Best AI Meeting Assistants 2026 ↗</span>
          <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}> · directory · low effort</span>
        </DetailRow>
        <DetailRow label="Evidence">A curated directory fathom.video and otter.ai both appear on.</DetailRow>
        <div style={{ display: "flex", gap: 18, marginTop: 2 }}>
          <MeterRow label="Ease" value={0.8} />
          <MeterRow label="Impact" value={0.45} />
        </div>
      </DetailPanel>

      <DetailPanel kind="post" title="Your daily post">
        <DetailRow label="How it works">
          Daily post angles rotate through your content topics, your buyers’ pains, and live market insights from your scan — so you always have something grounded to say. Ten minutes, every day.
        </DetailRow>
        <DetailRow label="Coming up">
          <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 12, color: "var(--c-muted)" }}>· The hidden cost of manual meeting notes</span>
            <span style={{ fontSize: 12, color: "var(--c-muted)" }}>· Why solo founders churn from otter.ai</span>
          </span>
        </DetailRow>
      </DetailPanel>
    </div>
  );
}
