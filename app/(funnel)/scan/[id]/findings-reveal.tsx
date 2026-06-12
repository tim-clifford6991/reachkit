"use client";

import dynamic from "next/dynamic";
import type {
  Finding,
  ScoreResult,
  PositioningMirror,
  SampleAction,
} from "@/lib/llm/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmailGate } from "./email-gate";

// Lazy-load Motion so it's deferred until findings arrive
const NumberTicker = dynamic(
  () =>
    import("@/components/motion/number-ticker").then((m) => m.NumberTicker),
  { ssr: false, loading: () => <span>—</span> }
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
// Score ring — CSS-only conic-gradient, no heavy lib
// ---------------------------------------------------------------------------
function ScoreRing({ value, size = 120 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const conicStyle = {
    background: `conic-gradient(
      oklch(0.6 0.18 255) ${pct}%,
      oklch(1 0 0 / 10%) ${pct}%
    )`,
    width: size,
    height: size,
    borderRadius: "50%",
  } satisfies React.CSSProperties;

  const innerSize = size * 0.72;
  const innerStyle = {
    width: innerSize,
    height: innerSize,
    borderRadius: "50%",
    background: "var(--card)",
  } satisfies React.CSSProperties;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={conicStyle}
      aria-hidden
    >
      <div
        className="absolute flex flex-col items-center justify-center"
        style={innerStyle}
      >
        <NumberTicker
          value={value}
          className="text-2xl font-bold tabular-nums leading-none text-foreground"
        />
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Axis bars
// ---------------------------------------------------------------------------
function AxisBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="capitalize text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground/80">{pct}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blurred / locked finding
// ---------------------------------------------------------------------------
function LockedFinding({ claim }: { claim: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="px-4 py-3">
        <p className="text-sm font-medium text-foreground/90 blur-[3px] select-none">
          {claim}
        </p>
        <p className="mt-1 text-xs text-muted-foreground blur-[3px] select-none">
          evidence from multiple sources
        </p>
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
        <Badge variant="secondary" className="gap-1 text-xs">
          <span>🔒</span>
          <span>Unlock with your full report</span>
        </Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// First finding — shown in full
// ---------------------------------------------------------------------------
function FullFinding({ finding }: { finding: Finding }) {
  const categoryLabel =
    finding.category === "seo_aso" ? "SEO / ASO" : finding.category;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm">{finding.claim}</CardTitle>
          <Badge variant="outline" className="shrink-0 capitalize">
            {categoryLabel}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {finding.basis === "evidence_based"
            ? "Evidence-based"
            : "Probability-based"}{" "}
          · confidence {Math.round(finding.confidence * 100)}%
        </CardDescription>
      </CardHeader>
      {finding.evidence.length > 0 && (
        <CardContent>
          <ul className="space-y-2">
            {finding.evidence.map((ev, i) => (
              <li key={i} className="rounded-lg bg-muted/30 px-3 py-2 text-xs">
                <p className="text-foreground/90 italic">
                  &ldquo;{ev.excerpt}&rdquo;
                </p>
                <p className="mt-1 text-muted-foreground">{ev.source}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FindingsReveal — exported (lazy-loaded from scan-stream)
// ---------------------------------------------------------------------------
export function FindingsReveal({
  scanId,
  data,
}: {
  scanId: string;
  data: FindingsPayload;
}) {
  const { score, positioningMirror, findings, sampleAction } = data;
  const [firstFinding, ...restFindings] = findings;

  return (
    <div className="space-y-5">
      {/* Discoverability score */}
      <Card>
        <CardHeader>
          <CardTitle>Discoverability Score</CardTitle>
          <CardDescription>
            Preliminary score based on content, outreach, and SEO signals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <ScoreRing value={score.total} />
            <div className="flex-1 w-full space-y-3">
              <AxisBar label="content" value={score.breakdown.content} />
              <AxisBar label="outreach" value={score.breakdown.outreach} />
              <AxisBar label="SEO / ASO" value={score.breakdown.seo} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positioning mirror */}
      <Card>
        <CardHeader>
          <CardTitle>Positioning Mirror</CardTitle>
          <CardDescription>
            Where your messaging and your audience diverge
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your listing says
              </dt>
              <dd className="text-foreground/90">
                {positioningMirror.listingSays}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Your reviews value
              </dt>
              <dd className="text-foreground/90">
                {positioningMirror.reviewsValue}
              </dd>
            </div>
            <div className="rounded-lg bg-destructive/10 px-3 py-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-destructive/80">
                Gap
              </dt>
              <dd className="mt-0.5 text-sm text-foreground/80">
                {positioningMirror.gap}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Findings */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Findings
        </h2>

        {firstFinding !== undefined && <FullFinding finding={firstFinding} />}

        {restFindings.length > 0 && (
          <div className="space-y-2">
            {restFindings.map((f, i) => (
              <LockedFinding key={i} claim={f.claim} />
            ))}
          </div>
        )}
      </div>

      {/* Sample action — blurred/locked */}
      <div className="relative overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Card className="ring-0 rounded-xl">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-sm blur-[3px] select-none">
                {sampleAction.title}
              </CardTitle>
              <Badge
                variant="outline"
                className="shrink-0 capitalize blur-[3px] select-none"
              >
                {sampleAction.category === "seo_aso"
                  ? "SEO / ASO"
                  : sampleAction.category}
              </Badge>
            </div>
            <CardDescription className="blur-[3px] select-none">
              {sampleAction.why}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-xs text-muted-foreground blur-[3px] select-none line-clamp-3">
              {sampleAction.draft}
            </p>
          </CardContent>
        </Card>
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
          <Badge variant="secondary" className="gap-1 text-xs">
            <span>🔒</span>
            <span>Unlock with your full report</span>
          </Badge>
        </div>
      </div>

      {/* Email gate — moment 4 */}
      <Card className="border-primary/20 ring-primary/20">
        <CardHeader>
          <CardTitle>Get your full discoverability report</CardTitle>
          <CardDescription>
            Unlock all findings +{" "}
            {restFindings.length > 0
              ? `${restFindings.length} more`
              : "personalised"}{" "}
            action steps — no credit card, one click.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailGate scanId={scanId} />
        </CardContent>
      </Card>
    </div>
  );
}
