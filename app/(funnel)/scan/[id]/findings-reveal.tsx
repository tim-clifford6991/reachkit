"use client";

import dynamic from "next/dynamic";
import type {
  Finding,
  ScoreResult,
  PositioningMirror,
  SampleAction,
} from "@/lib/llm/types";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Lazy-load heavy components — keeps the initial funnel chunk lean
// ---------------------------------------------------------------------------

// DiscoverabilityScore: SVG-based, drives view-transition shared-element morph
const DiscoverabilityScore = dynamic(
  () =>
    import("@/components/report/discoverability-score").then(
      (m) => m.DiscoverabilityScore
    ),
  { ssr: false, loading: () => <ScoreRingSkeleton /> }
);

// Motion stagger for the findings list
const Stagger = dynamic(
  () => import("@/components/motion/stagger").then((m) => m.Stagger),
  { ssr: false, loading: () => null }
);

// Email gate — only shown after the scan completes, so defer its chunk to keep
// the initial funnel bundle under the §20.4 budget.
const EmailGate = dynamic(
  () => import("./email-gate").then((m) => m.EmailGate),
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
// Skeleton — shown while DiscoverabilityScore lazy-loads
// ---------------------------------------------------------------------------

function ScoreRingSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="h-[140px] w-[140px] animate-pulse rounded-full"
        style={{ background: "var(--fill-subtle)" }}
        aria-hidden="true"
      />
      <div
        className="h-3 w-20 animate-pulse rounded-lg"
        style={{ background: "var(--fill-subtle)" }}
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build a VerifiedScore-shaped object from the ScoreResult we have at this
// stage. The partial-reveal score is "preliminary" (basis from facts), so we
// annotate it with an empty radar to satisfy DiscoverabilityScore's type.
// The real radar appears on the full results page after email unlock.
// ---------------------------------------------------------------------------

function buildPreviewScore(score: ScoreResult) {
  return {
    ...score,
    radar: [] as Array<{ axis: string; value: number; active: boolean }>,
    basis: "preliminary" as const,
  };
}

// ---------------------------------------------------------------------------
// First finding — shown IN FULL with evidence links (§23 moment 3)
// ---------------------------------------------------------------------------

function FullFinding({ finding }: { finding: Finding }) {
  const categoryLabel =
    finding.category === "seo_aso" ? "SEO / ASO" : finding.category;

  return (
    <div
      className="space-y-3 rounded-xl border p-7"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="text-sm font-medium leading-snug"
          style={{ color: "var(--color-fg)" }}
        >
          {finding.claim}
        </p>
        <Badge variant="outline" className="shrink-0 capitalize">
          {categoryLabel}
        </Badge>
      </div>

      <p
        className="font-mono text-xs"
        style={{ color: "var(--color-muted)" }}
      >
        {finding.basis === "evidence_based" ? "Evidence-based" : "Probability-based"}
        {" · "}confidence {Math.round(finding.confidence * 100)}%
      </p>

      {finding.evidence.length > 0 && (
        <ul className="space-y-2">
          {finding.evidence.map((ev, i) => (
            <li
              key={i}
              className="rounded-lg px-3 py-2.5"
              style={{ background: "var(--fill-subtle)" }}
            >
              <p
                className="text-xs italic leading-relaxed"
                style={{ color: "oklch(0.90 0 0)" }}
              >
                &ldquo;{ev.excerpt}&rdquo;
              </p>
              <p
                className="mt-1 font-mono text-[10px]"
                style={{ color: "var(--color-muted)" }}
              >
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
      className="relative overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--hairline)" }}
      aria-label={`Locked finding ${index + 1}: unlock to read`}
    >
      {/* Real headline + preview — blurred */}
      <div
        className="select-none px-7 py-4"
        style={{ background: "var(--color-surface)" }}
        aria-hidden="true"
      >
        <p
          className="text-sm font-medium leading-snug blur-[4px]"
          style={{ color: "var(--color-fg)" }}
        >
          {finding.claim}
        </p>
        <p
          className="mt-1.5 font-mono text-xs blur-[3px]"
          style={{ color: "var(--color-muted)" }}
        >
          {evidenceLabel} · {communityHint}
        </p>
      </div>

      {/* Lock overlay — clickable: prompts the email gate */}
      <LockBadge label={`Unlock finding ${index + 1} with your email`} />
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
      className="mt-1.5 size-1.5 shrink-0 rounded-full"
      style={{ background: "var(--color-accent-500)" }}
      aria-hidden="true"
    />
  );
}

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="5"
        width="9"
        height="6.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        style={{ color: "oklch(0.76 0 0)" }}
      />
      <path
        d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        style={{ color: "oklch(0.76 0 0)" }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Unlock interaction — every locked element is an actionable CTA: clicking it
// scrolls to the email gate and focuses the field, prompting the user to unlock.
// ---------------------------------------------------------------------------

function scrollToGate() {
  if (typeof document === "undefined") return;
  document
    .getElementById("unlock-gate")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
  // Focus the email field once the smooth-scroll is underway.
  setTimeout(() => document.getElementById("unlock-email")?.focus(), 350);
}

/** Clickable lock overlay — prompts the email gate on click. */
function LockBadge({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={scrollToGate}
      className="absolute inset-0 flex cursor-pointer items-center justify-center backdrop-blur-[2px] transition-transform hover:scale-[1.02] motion-reduce:transform-none"
      aria-label={label}
    >
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-1.5"
        style={{ borderColor: "oklch(1 0 0 / 0.18)", background: "oklch(0.085 0 0 / 0.85)" }}
      >
        <LockIcon />
        <span className="text-xs font-medium" style={{ color: "oklch(0.96 0.006 85)" }}>
          Unlock with email
        </span>
      </div>
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

  // Build the preview score — uses the DiscoverabilityScore visual (signature moment)
  const previewScore = buildPreviewScore(score);

  return (
    <div className="space-y-6">
      {/* ── Score reveal — THE signature moment (§23.3) ─────────────────── */}
      <div
        className="flex flex-col items-center rounded-xl border py-8"
        style={{
          borderColor: "var(--color-accent-900)",
          background:
            "linear-gradient(135deg, var(--color-surface) 0%, var(--color-elevated) 100%)",
        }}
      >
        <p
          className="mb-6 font-mono text-xs uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Your discoverability score
        </p>

        {/* DiscoverabilityScore — count-up NumberTicker + radial sweep */}
        <DiscoverabilityScore
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          score={previewScore as any}
          size="sm"
        />

        <p
          className="mt-6 max-w-xs text-center text-xs leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          Based on content signals, keyword coverage, and competitive gaps.
          Your full report reveals exactly what to fix first.
        </p>
      </div>

      {/* ── Positioning mirror ───────────────────────────────────────────── */}
      <div
        className="space-y-3 rounded-xl border p-7"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <h2
          className="font-mono text-xs uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Positioning mirror
        </h2>

        <div className="space-y-3">
          <div className="space-y-1">
            <p
              className="font-mono text-[10px] uppercase tracking-wider"
              style={{ color: "var(--color-muted)" }}
            >
              Your listing says
            </p>
            <p className="text-sm" style={{ color: "var(--color-fg)" }}>
              {positioningMirror.listingSays}
            </p>
          </div>

          <div className="space-y-1">
            <p
              className="font-mono text-[10px] uppercase tracking-wider"
              style={{ color: "var(--color-muted)" }}
            >
              Your reviews value
            </p>
            <p className="text-sm" style={{ color: "var(--color-fg)" }}>
              {positioningMirror.reviewsValue}
            </p>
          </div>

          <div
            className="rounded-lg px-3 py-2.5"
            style={{ background: "var(--color-danger-subtle)" }}
          >
            <p
              className="font-mono text-[10px] uppercase tracking-wider"
              style={{ color: "oklch(0.70 0.20 22 / 0.8)" }}
            >
              Gap
            </p>
            <p
              className="mt-0.5 text-sm"
              style={{ color: "var(--color-fg)" }}
            >
              {positioningMirror.gap}
            </p>
          </div>
        </div>
      </div>

      {/* ── Findings — first one full, rest blur-locked ──────────────────── */}
      <div className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Findings
        </h2>

        {/* First finding — shown IN FULL with evidence */}
        {firstFinding !== undefined && <FullFinding finding={firstFinding} />}

        {/* Remaining findings — real headlines blur-locked */}
        {restFindings.length > 0 && (
          <div className="space-y-2">
            <Stagger>
              {restFindings.map((f, i) => (
                <LockedFinding key={i} finding={f} index={i} />
              ))}
            </Stagger>
          </div>
        )}
      </div>

      {/* ── Sample action — blur-locked with real title visible ─────────── */}
      <div
        className="relative overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--hairline)" }}
      >
        <div
          className="select-none space-y-2 p-7"
          style={{ background: "var(--color-surface)" }}
          aria-hidden="true"
        >
          <div className="flex items-start justify-between gap-3">
            <p
              className="text-sm font-medium leading-snug blur-[4px]"
              style={{ color: "var(--color-fg)" }}
            >
              {sampleAction.title}
            </p>
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-xs blur-[3px]"
              style={{
                borderColor: "var(--hairline)",
                color: "var(--color-muted)",
              }}
            >
              {categoryLabel(sampleAction.category)}
            </span>
          </div>
          <p
            className="text-xs leading-relaxed blur-[4px]"
            style={{ color: "var(--color-muted)" }}
          >
            {sampleAction.why}
          </p>
          <p
            className="mt-2 rounded-lg px-3 py-2 font-mono text-xs leading-relaxed blur-[4px] line-clamp-3"
            style={{
              background: "var(--fill-subtle)",
              color: "var(--color-muted)",
            }}
          >
            {sampleAction.draft}
          </p>
        </div>
        <LockBadge label="Unlock your action plan with your email" />
      </div>

      {/* ── What your report also contains (pre-gate teaser) ─────────────── */}
      <div
        className="rounded-xl border p-7"
        style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
      >
        <p
          className="mb-3 font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          What your report also contains
        </p>
        <ul className="space-y-2 text-sm" style={{ color: "var(--color-fg)" }}>
          {competitorCount > 0 && (
            <li className="flex items-start gap-2.5">
              <TeaserDot />
              {competitorCount} competitor{competitorCount === 1 ? "" : "s"} analysed — their
              positioning and where they outrank you
            </li>
          )}
          <li className="flex items-start gap-2.5">
            <TeaserDot />
            The communities where your buyers actually gather
          </li>
          <li className="flex items-start gap-2.5">
            <TeaserDot />
            A prioritized action plan across content, outreach &amp; SEO
          </li>
        </ul>
        <button
          type="button"
          onClick={scrollToGate}
          className="mt-4 text-xs font-medium underline underline-offset-4 transition-colors"
          style={{ color: "var(--color-accent-400)" }}
        >
          Unlock the full report with your email →
        </button>
      </div>

      {/* ── Moment 4: Email gate (every locked CTA scrolls + focuses here) ── */}
      <div
        id="unlock-gate"
        className="scroll-mt-8 rounded-xl border p-8"
        style={{
          borderColor: "var(--color-accent-900)",
          background:
            "linear-gradient(135deg, var(--color-surface) 0%, var(--color-elevated) 100%)",
        }}
      >
        <div className="mb-5 space-y-1.5">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            See who&apos;s ahead — and exactly what to do about it
          </h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Unlock all{" "}
            {restFindings.length > 0
              ? `${restFindings.length + 1} findings`
              : "findings"}{" "}
            + personalised action steps — one magic link, no password.
          </p>
        </div>
        <EmailGate scanId={scanId} />
      </div>
    </div>
  );
}
