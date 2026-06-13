"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PreliminaryFacts, ScanEvent } from "@/lib/scan/types";
import type { FindingsPayload } from "./findings-reveal";
import { funnel } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";

// Lazy-load the entire findings reveal (includes Motion + EmailGate + base-ui)
// so none of it lands in the initial funnel chunk.
const FindingsReveal = dynamic(
  () => import("./findings-reveal").then((m) => m.FindingsReveal),
  { ssr: false, loading: () => null }
);

// Lazy-load the Stagger animation for the working feed.
const Stagger = dynamic(
  () => import("@/components/motion/stagger").then((m) => m.Stagger),
  { ssr: false, loading: () => null }
);

// ── Pulse dot — CSS only, no JS ───────────────────────────────────────────────
function PulseDot() {
  return (
    <span
      className="relative mt-0.5 flex h-2 w-2 shrink-0"
      aria-hidden="true"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
    </span>
  );
}

// ── Artifact line — materialises as SSE events arrive ─────────────────────────
function ArtifactLine({ text, index }: { text: string; index: number }) {
  // Stagger mounts each line — the Stagger wrapper handles the y + opacity animation.
  // We just need the right visual here.
  return (
    <div
      key={index}
      className="flex items-start gap-2"
      style={{ color: "var(--color-muted)" }}
    >
      {/* Check mark — accent colour when done */}
      <span
        className="mt-px font-mono text-xs"
        style={{ color: "var(--color-accent-400)" }}
        aria-hidden="true"
      >
        ✓
      </span>
      <span className="font-mono text-sm leading-snug">{text}</span>
    </div>
  );
}

// ── Loading theater — shown while facts haven't arrived yet ───────────────────
function ScanTheater({ artifacts }: { artifacts: string[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PulseDot />
        <p
          className="font-mono text-sm tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Scanning your product…
        </p>
      </div>

      {/* Artifact feed — each line materialises as the SSE event lands */}
      <div
        className="space-y-2 rounded-xl border p-5"
        style={{
          borderColor: "oklch(1 0 0 / 0.07)",
          background: "var(--color-surface)",
        }}
        role="log"
        aria-live="polite"
        aria-label="Scan progress"
      >
        {artifacts.length === 0 ? (
          <div
            className="flex items-start gap-2"
            style={{ color: "var(--color-muted)" }}
          >
            <span
              className="mt-px font-mono text-xs"
              style={{ color: "var(--color-accent-400)" }}
              aria-hidden="true"
            >
              →
            </span>
            <span className="font-mono text-sm">Starting scan…</span>
          </div>
        ) : (
          <Stagger>
            {artifacts.map((a, i) => (
              <ArtifactLine key={i} text={a} index={i} />
            ))}
          </Stagger>
        )}
      </div>

      {/* Skeleton cards — hint that content is coming */}
      <div className="space-y-3 opacity-40">
        {[80, 60, 40].map((w) => (
          <div
            key={w}
            className="h-4 animate-pulse rounded-lg"
            style={{
              width: `${w}%`,
              background: "oklch(1 0 0 / 0.06)",
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

// ── Facts cards — shown after the `facts` SSE event ──────────────────────────

interface FactsViewProps {
  facts: PreliminaryFacts;
  artifacts: string[];
  findingsData: FindingsPayload | null;
  scanId: string;
}

function FactsView({ facts, artifacts, findingsData, scanId }: FactsViewProps) {
  const isApp = facts.mode === "ios" || facts.mode === "android";
  const ratingDisplay =
    facts.ratingTrend != null ? facts.ratingTrend.toFixed(1) : "—";
  const webScore =
    facts.webProxy != null ? facts.webProxy.score.toFixed(0) : "—";

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-8">
      {/* ── Product header ──────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: "oklch(1 0 0 / 0.09)",
          background: "var(--color-surface)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="truncate text-lg font-semibold leading-tight"
              style={{ color: "var(--color-fg)" }}
            >
              {facts.listing.name}
            </h1>
            {facts.listing.category != null && (
              <p
                className="mt-0.5 text-sm"
                style={{ color: "var(--color-muted)" }}
              >
                {facts.listing.category}
              </p>
            )}
          </div>
          <Badge variant="outline" className="shrink-0 capitalize">
            {facts.mode}
          </Badge>
        </div>

        {facts.listing.description != null && (
          <p
            className="mt-3 line-clamp-3 text-sm leading-relaxed"
            style={{ color: "var(--color-muted)" }}
          >
            {facts.listing.description}
          </p>
        )}
      </div>

      {/* ── Signal metrics ───────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 gap-px rounded-xl border overflow-hidden sm:grid-cols-4"
        style={{
          borderColor: "oklch(1 0 0 / 0.09)",
          background: "oklch(1 0 0 / 0.09)",
        }}
      >
        <MetricCell label="Reviews" value={String(facts.reviewVolume)} />
        {isApp ? (
          <MetricCell label="Avg rating" value={ratingDisplay} />
        ) : (
          facts.webProxy != null && (
            <>
              <MetricCell label="Web score" value={webScore} />
              <MetricCell
                label="SERP results"
                value={facts.webProxy.serpResultCount.toLocaleString()}
              />
            </>
          )
        )}
        {facts.competitors.length > 0 && (
          <MetricCell
            label="Competitors"
            value={String(facts.competitors.length)}
          />
        )}
      </div>

      {/* ── Competitors ──────────────────────────────────────────────────── */}
      {facts.competitors.length > 0 && (
        <div
          className="rounded-xl border p-5"
          style={{
            borderColor: "oklch(1 0 0 / 0.09)",
            background: "var(--color-surface)",
          }}
        >
          <h2
            className="mb-3 font-mono text-xs uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Competitors found
          </h2>
          <ol className="space-y-2">
            {facts.competitors.slice(0, 5).map((c, i) => (
              <li
                key={i}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  className="w-5 shrink-0 text-right font-mono text-xs tabular-nums"
                  style={{ color: "var(--color-muted)" }}
                >
                  {c.rank}
                </span>
                <span
                  className="flex-1 truncate font-medium"
                  style={{ color: "var(--color-fg)" }}
                >
                  {c.name}
                </span>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {c.source}
                </Badge>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Theme chips ──────────────────────────────────────────────────── */}
      {facts.themes.length > 0 && (
        <div
          className="rounded-xl border p-5"
          style={{
            borderColor: "oklch(1 0 0 / 0.09)",
            background: "var(--color-surface)",
          }}
        >
          <h2
            className="mb-3 font-mono text-xs uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Key themes
          </h2>
          <div className="flex flex-wrap gap-2">
            {facts.themes.slice(0, 10).map((t, i) => (
              <span
                key={i}
                className="rounded-full border px-2.5 py-0.5 font-mono text-xs"
                style={{
                  borderColor: "oklch(1 0 0 / 0.09)",
                  color: "var(--color-muted)",
                }}
              >
                {t.term}
                <span
                  className="ml-1.5 tabular-nums"
                  style={{ color: "oklch(1 0 0 / 0.35)" }}
                >
                  {t.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Working artifact feed (still running) ────────────────────────── */}
      {artifacts.length > 0 && !findingsData && (
        <div
          className="rounded-xl border p-5"
          style={{
            borderColor: "oklch(1 0 0 / 0.07)",
            background: "var(--color-surface)",
          }}
          role="log"
          aria-live="polite"
          aria-label="Scan progress"
        >
          <div className="mb-3 flex items-center gap-2">
            <PulseDot />
            <p
              className="font-mono text-xs tracking-wide"
              style={{ color: "var(--color-muted)" }}
            >
              Analysis in progress
            </p>
          </div>
          <div className="space-y-1.5">
            <Stagger>
              {artifacts.map((a, i) => (
                <ArtifactLine key={i} text={a} index={i} />
              ))}
            </Stagger>
          </div>
        </div>
      )}

      {/* ── Moments 3 + 4: Findings reveal + email gate ──────────────────── */}
      {findingsData != null && (
        <FindingsReveal scanId={scanId} data={findingsData} />
      )}
    </div>
  );
}

// Compact metric cell for the stats grid
function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 p-4"
      style={{ background: "var(--color-surface)" }}
    >
      <span
        className="font-mono text-[10px] uppercase tracking-wider"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </span>
      <span
        className="font-mono text-xl font-semibold tabular-nums leading-tight"
        style={{ color: "var(--color-fg)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ScanStream({ id }: { id: string }) {
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [facts, setFacts] = useState<PreliminaryFacts | null>(null);
  const [findingsData, setFindingsData] = useState<FindingsPayload | null>(
    null
  );

  useEffect(() => {
    const es = new EventSource(`/api/scan/${id}/stream`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data as string) as ScanEvent;
      if (e.type === "artifact") {
        setArtifacts((a) => [...a, String(e.payload["label"] ?? "working")]);
      } else if (e.type === "facts") {
        const factsPayload = e.payload as unknown as PreliminaryFacts;
        setFacts(factsPayload);
        funnel.factsShown({ scan_id: id, mode: factsPayload.mode });
      } else if (e.type === "findings") {
        const findingsPayload = e.payload as unknown as FindingsPayload;
        setFindingsData(findingsPayload);
        funnel.findingsShown({ scan_id: id, score: findingsPayload.score.total });
      } else if (e.type === "done" || e.type === "error") {
        es.close();
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [id]);

  if (!facts) {
    return <ScanTheater artifacts={artifacts} />;
  }

  return (
    <FactsView
      facts={facts}
      artifacts={artifacts}
      findingsData={findingsData}
      scanId={id}
    />
  );
}
