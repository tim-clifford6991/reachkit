"use client";

import type * as React from "react";
import dynamic from "next/dynamic";
import type {
  Finding,
  ScoreResult,
  PositioningMirror,
  SampleAction,
} from "@/lib/llm/types";
import { ScoreGauge } from "@/components/report/score-gauge";

// ---------------------------------------------------------------------------
// Design idiom: intel-kit — inline styles + `--c-*` tokens, Space Grotesk /
// Plus Jakarta Sans / JetBrains Mono. The score dial is the SAME canonical
// gauge geometry the results screen uses (components/report/score-gauge.tsx).
// ---------------------------------------------------------------------------

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";

const CARD: React.CSSProperties = {
  background: "var(--c-surface)",
  border: "1px solid var(--c-line)",
  borderRadius: 14,
};

// Motion stagger for the findings list
const Stagger = dynamic(
  () => import("@/components/motion/stagger").then((m) => m.Stagger),
  { ssr: false, loading: () => null }
);

// Trial CTA — the single trial wall (replaces the old email gate). Deferred to
// keep the initial funnel bundle under the §20.4 budget.
const TrialCta = dynamic(
  () => import("@/components/report/trial-cta").then((m) => m.TrialCta),
  { ssr: false, loading: () => null }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FindingsPayload {
  score: ScoreResult;
  positioningMirror: PositioningMirror;
  findings: Finding[];
  sampleAction: SampleAction;
}

// ---------------------------------------------------------------------------
// Small kit primitives (local — funnel-only)
// ---------------------------------------------------------------------------

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)", margin: 0, ...style }}>
      {children}
    </p>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", background: "var(--c-fill)", color: "var(--c-muted)", fontFamily: PJ, fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: 6, lineHeight: 1.2, whiteSpace: "nowrap", textTransform: "capitalize" }}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// First finding — shown IN FULL with evidence links (§23 moment 3)
// ---------------------------------------------------------------------------

function FullFinding({ finding }: { finding: Finding }) {
  const label = finding.category === "seo_aso" ? "SEO / ASO" : finding.category;

  return (
    <div style={{ ...CARD, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <p style={{ fontFamily: PJ, fontSize: 14.5, fontWeight: 600, lineHeight: 1.45, color: "var(--c-ink)", margin: 0 }}>
          {finding.claim}
        </p>
        <Chip>{label}</Chip>
      </div>

      <p style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", margin: 0 }}>
        {finding.basis === "evidence_based" ? "Evidence-based" : "Probability-based"}
        {" · "}confidence {Math.round(finding.confidence * 100)}%
      </p>

      {finding.evidence.length > 0 && (
        <ul style={{ display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, listStyle: "none" }}>
          {finding.evidence.map((ev, i) => (
            <li key={i} style={{ background: "var(--c-fill)", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ fontFamily: PJ, fontSize: 12.5, fontStyle: "italic", lineHeight: 1.6, color: "var(--c-muted)", margin: 0 }}>
                &ldquo;{ev.excerpt}&rdquo;
              </p>
              <p style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", margin: "4px 0 0" }}>
                {ev.source}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Locked finding — REAL headline visible under blur (honest curiosity gap)
// Never fake teasers — the actual claim is present, just visually locked.
// ---------------------------------------------------------------------------

function LockedFinding({ finding, index }: { finding: Finding; index: number }) {
  const communityHint = finding.category === "outreach"
    ? "communities where your users are talking about this"
    : finding.category === "seo_aso"
    ? "keyword + ranking opportunities"
    : "content gaps identified";

  const evidenceCount = finding.evidence.length;
  const evidenceLabel = evidenceCount > 0
    ? `${evidenceCount} source${evidenceCount === 1 ? "" : "s"}`
    : "evidence from multiple sources";

  return (
    <div
      style={{ ...CARD, position: "relative", overflow: "hidden" }}
      aria-label={`Locked finding ${index + 1}: unlock to read`}
    >
      {/* Real headline + preview — blurred */}
      <div style={{ userSelect: "none", padding: "16px 22px" }} aria-hidden="true">
        <p style={{ fontFamily: PJ, fontSize: 14.5, fontWeight: 600, lineHeight: 1.45, color: "var(--c-ink)", margin: 0, filter: "blur(4px)" }}>
          {finding.claim}
        </p>
        <p style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", margin: "6px 0 0", filter: "blur(3px)" }}>
          {evidenceLabel} · {communityHint}
        </p>
      </div>

      {/* Lock overlay — clickable: prompts the trial CTA */}
      <LockBadge label={`Unlock finding ${index + 1}`} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category label helper
// ---------------------------------------------------------------------------

function categoryLabel(cat: string): string {
  if (cat === "seo_aso") return "SEO / ASO";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ---------------------------------------------------------------------------
// SVG lock icon — inline, no import
// ---------------------------------------------------------------------------

function TeaserDot() {
  return (
    <span
      style={{ marginTop: 6, width: 6, height: 6, flexShrink: 0, borderRadius: "50%", background: "var(--c-action)" }}
      aria-hidden="true"
    />
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ color: "var(--c-on-dark-muted)" }}>
      <rect x="1.5" y="5" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Unlock interaction — every locked element is an actionable CTA: clicking it
// scrolls to the unlock CTA, prompting the user to unlock the full report.
// ---------------------------------------------------------------------------

function scrollToGate() {
  if (typeof document === "undefined") return;
  document
    .getElementById("unlock-gate")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Clickable lock overlay — prompts the trial CTA on click. */
function LockBadge({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={scrollToGate}
      style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "transparent", border: "none", padding: 0, backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      aria-label={label}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 999, background: "var(--c-dark)", border: "1px solid var(--c-dark2)", padding: "6px 13px", boxShadow: "rgba(40,33,84,0.28) 0px 10px 26px -12px" }}>
        <LockIcon />
        <span style={{ fontFamily: PJ, fontSize: 12, fontWeight: 600, color: "var(--c-on-dark)" }}>
          Unlock full report
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// FindingsReveal — exported (lazy-loaded from scan-stream)
// ---------------------------------------------------------------------------

export function FindingsReveal({
  scanId,
  data,
  competitorCount = 0,
}: {
  scanId: string;
  data: FindingsPayload;
  competitorCount?: number;
}) {
  const { score, positioningMirror, findings, sampleAction } = data;
  const [firstFinding, ...restFindings] = findings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: PJ, color: "var(--c-ink)" }}>
      {/* ── Score reveal — THE signature moment (§23.3): the SAME canonical
             gauge the results screen renders seconds later. ───────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "linear-gradient(120deg, var(--c-tint-violet), var(--c-soft))", border: "1px solid var(--c-tint-violet-line)", borderRadius: 16, padding: "32px 24px" }}>
        <Eyebrow style={{ marginBottom: 20 }}>Your discoverability score</Eyebrow>

        <ScoreGauge score={score.total} size={200} />

        <p style={{ marginTop: 20, maxWidth: 320, textAlign: "center", fontSize: 12.5, lineHeight: 1.6, color: "var(--c-muted)" }}>
          Based on content signals, keyword coverage, and competitive gaps.
          Your full report reveals exactly what to fix first.
        </p>
      </div>

      {/* ── Positioning mirror ───────────────────────────────────────────── */}
      <div style={{ ...CARD, borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0 }}>
          Positioning mirror
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <Eyebrow>Your listing says</Eyebrow>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--c-ink)", margin: "4px 0 0" }}>
              {positioningMirror.listingSays}
            </p>
          </div>

          <div>
            <Eyebrow>Your reviews value</Eyebrow>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--c-ink)", margin: "4px 0 0" }}>
              {positioningMirror.reviewsValue}
            </p>
          </div>

          <div style={{ background: "var(--c-tint-red)", borderLeft: "3px solid #E5484D", borderRadius: "0 10px 10px 0", padding: "10px 14px" }}>
            <Eyebrow style={{ color: "#E5484D" }}>Gap</Eyebrow>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--c-ink)", margin: "2px 0 0" }}>
              {positioningMirror.gap}
            </p>
          </div>
        </div>
      </div>

      {/* ── Findings — first one full, rest blur-locked ──────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Eyebrow>Findings</Eyebrow>

        {/* First finding — shown IN FULL with evidence */}
        {firstFinding !== undefined && <FullFinding finding={firstFinding} />}

        {/* Remaining findings — real headlines blur-locked */}
        {restFindings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Stagger>
              {restFindings.map((f, i) => (
                <LockedFinding key={i} finding={f} index={i} />
              ))}
            </Stagger>
          </div>
        )}
      </div>

      {/* ── Sample action — blur-locked with real title visible ─────────── */}
      <div style={{ ...CARD, position: "relative", overflow: "hidden" }}>
        <div style={{ userSelect: "none", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 8 }} aria-hidden="true">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.45, color: "var(--c-ink)", margin: 0, filter: "blur(4px)" }}>
              {sampleAction.title}
            </p>
            <span style={{ filter: "blur(3px)", display: "inline-flex" }}>
              <Chip>{categoryLabel(sampleAction.category)}</Chip>
            </span>
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--c-muted)", margin: 0, filter: "blur(4px)" }}>
            {sampleAction.why}
          </p>
          <p style={{ fontFamily: JM, fontSize: 12, lineHeight: 1.6, color: "var(--c-muted)", background: "var(--c-fill)", borderRadius: 10, padding: "8px 12px", margin: "4px 0 0", filter: "blur(4px)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {sampleAction.draft}
          </p>
        </div>
        <LockBadge label="Unlock your action plan" />
      </div>

      {/* ── What your report also contains (pre-gate teaser) ─────────────── */}
      <div style={{ ...CARD, padding: "20px 22px" }}>
        <Eyebrow style={{ marginBottom: 12 }}>What your report also contains</Eyebrow>
        <ul style={{ display: "flex", flexDirection: "column", gap: 8, margin: 0, padding: 0, listStyle: "none", fontSize: 14, lineHeight: 1.5, color: "var(--c-ink)" }}>
          {competitorCount > 0 && (
            <li style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <TeaserDot />
              <span>
                {competitorCount} competitor{competitorCount === 1 ? "" : "s"} analysed — their
                positioning and where they outrank you
              </span>
            </li>
          )}
          <li style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <TeaserDot />
            <span>The communities where your buyers actually gather</span>
          </li>
          <li style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <TeaserDot />
            <span>A prioritized action plan across content, outreach &amp; SEO</span>
          </li>
        </ul>
        <button
          type="button"
          onClick={scrollToGate}
          style={{ marginTop: 16, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: PJ, fontSize: 12.5, fontWeight: 600, color: "var(--c-action)", textDecoration: "underline", textUnderlineOffset: 4 }}
        >
          Unlock the full report →
        </button>
      </div>

      {/* ── Moment 4: Trial wall (every locked CTA scrolls here) ─────────── */}
      <div
        id="unlock-gate"
        style={{ scrollMarginTop: 32, background: "linear-gradient(120deg, var(--c-tint-violet), var(--c-soft))", border: "1px solid var(--c-tint-violet-line)", borderRadius: 16, padding: "28px 26px" }}
      >
        <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: 0 }}>
            See who&apos;s ahead — and exactly what to do about it
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--c-muted)", margin: 0 }}>
            Unlock the full report to see all{" "}
            {restFindings.length > 0
              ? `${restFindings.length + 1} findings`
              : "findings"}{" "}
            + your full deep analysis: competitive landscape, channels, creators,
            and a prioritised action plan.
          </p>
        </div>
        <TrialCta scanId={scanId} />
      </div>
    </div>
  );
}
