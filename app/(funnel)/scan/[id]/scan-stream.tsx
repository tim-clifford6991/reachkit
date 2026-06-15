"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PreliminaryFacts, ScanEvent } from "@/lib/scan/types";
import type { FindingsPayload } from "./findings-reveal";
import { funnel } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { competitorSourceLabel } from "@/lib/scan/source-labels";
import { ScanProgress } from "@/components/scan/scan-progress";

// Lazy-load the entire findings reveal (includes Motion + EmailGate + base-ui)
// so none of it lands in the initial funnel chunk.
const FindingsReveal = dynamic(
  () => import("./findings-reveal").then((m) => m.FindingsReveal),
  { ssr: false, loading: () => null }
);

// ── Facts cards — shown once findings are ready (the reveal) ──────────────────

interface FactsViewProps {
  facts: PreliminaryFacts;
  findingsData: FindingsPayload | null;
  scanId: string;
}

function FactsView({ facts, findingsData, scanId }: FactsViewProps) {
  const isApp = facts.mode === "ios" || facts.mode === "android";
  const ratingDisplay =
    facts.ratingTrend != null ? facts.ratingTrend.toFixed(1) : "—";
  const webScore =
    facts.webProxy != null ? facts.webProxy.score.toFixed(0) : "—";

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-8">
      {/* ── Product header ──────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-7"
        style={{
          borderColor: "var(--hairline)",
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
          borderColor: "var(--hairline)",
          background: "var(--hairline)",
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
          className="rounded-xl border p-7"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--color-surface)",
          }}
        >
          <h2
            className="mb-1 font-mono text-xs uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Your competitive landscape
          </h2>
          <p className="mb-4 text-xs" style={{ color: "var(--color-muted)" }}>
            Who shows up where your category buyers look:
          </p>
          <ul className="space-y-3">
            {facts.competitors.slice(0, 5).map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] tabular-nums"
                  style={{ background: "var(--fill-subtle)", color: "var(--color-muted)" }}
                >
                  {c.rank}
                </span>
                <div className="min-w-0">
                  <p
                    className="truncate font-medium"
                    style={{ color: "var(--color-fg)" }}
                  >
                    {c.name}
                  </p>
                  <p
                    className="text-xs leading-snug"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {competitorSourceLabel(c.source)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {facts.competitors.length > 5 && (
            <p
              className="mt-3 font-mono text-xs"
              style={{ color: "var(--color-muted)" }}
            >
              +{facts.competitors.length - 5} more mapped in your full report
            </p>
          )}
        </div>
      )}

      {/* ── Theme chips ──────────────────────────────────────────────────── */}
      {facts.themes.length > 0 && (
        <div
          className="rounded-xl border p-7"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--color-surface)",
          }}
        >
          <h2
            className="mb-1 font-mono text-xs uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            What buyers care about
          </h2>
          <p className="mb-3 text-xs" style={{ color: "var(--color-muted)" }}>
            From {facts.reviewVolume} reviews — the language your buyers use:
          </p>
          <div className="flex flex-wrap gap-2">
            {facts.themes.slice(0, 10).map((t, i) => (
              <span
                key={i}
                className="rounded-full border px-2.5 py-0.5 font-mono text-xs"
                style={{
                  borderColor: "var(--hairline)",
                  color: "var(--color-muted)",
                }}
              >
                {t.term}
                <span
                  className="ml-1.5 tabular-nums"
                  style={{ color: "var(--hairline-strong)" }}
                >
                  {t.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Moments 3 + 4: Findings reveal + email gate ──────────────────── */}
      {findingsData != null && (
        <FindingsReveal
          scanId={scanId}
          data={findingsData}
          competitorCount={facts.competitors.length}
        />
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

// ── Error state ───────────────────────────────────────────────────────────────

function ScanError() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-6 py-20 text-center">
      <span
        className="grid size-12 place-items-center rounded-full"
        style={{ background: "var(--color-danger-subtle)", color: "var(--color-danger)" }}
        aria-hidden
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
      <h2 className="text-2xl font-semibold" style={{ color: "var(--color-fg)" }}>
        This scan didn&apos;t finish
      </h2>
      <p className="text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
        Something went wrong while analysing your product, or it took too long. This is on us —
        please try running the scan again.
      </p>
      <Link
        href="/scan"
        className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px motion-reduce:transform-none"
        style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
      >
        Try another scan
      </Link>
    </div>
  );
}

// ── Seed from server-persisted events (refresh-safe hydration) ────────────────
// page.tsx reads scan_events server-side and passes them here, so a reload — or
// returning to the link later — renders the correct state immediately instead of
// re-animating from scratch (or, worse, falsely "failing" a scan that already
// finished while the page was closed).

type SeedEvent = { id: number; type: string; payload: Record<string, unknown> };

function buildSeed(events: SeedEvent[]) {
  const artifacts: string[] = [];
  let facts: PreliminaryFacts | null = null;
  let findings: FindingsPayload | null = null;
  let done = false;
  let errored = false;
  let lastId = 0;
  for (const e of events) {
    if (typeof e.id === "number" && e.id > lastId) lastId = e.id;
    if (e.type === "artifact") {
      artifacts.push(String(e.payload?.["label"] ?? "working"));
    } else if (e.type === "facts") {
      facts = e.payload as unknown as PreliminaryFacts;
    } else if (e.type === "findings") {
      findings = e.payload as unknown as FindingsPayload;
    } else if (e.type === "done") {
      done = true;
    } else if (e.type === "error") {
      errored = true;
    }
  }
  return { artifacts, facts, findings, done, errored, lastId };
}

// The scans.status values that mean the pipeline is STILL running. Any other
// persisted status (done / degraded / failed) — or a terminal event already in
// the seed — means the scan has finished and there is nothing left to stream.
const ACTIVE_STATUSES = [
  "queued",
  "collecting",
  "extracting",
  "synthesizing",
  "critiquing",
  "formatting",
];

// ── Main export ───────────────────────────────────────────────────────────────

export function ScanStream({
  id,
  scanExists = true,
  initialStatus = null,
  initialEvents = [],
  host = null,
}: {
  id: string;
  scanExists?: boolean;
  initialStatus?: string | null;
  initialEvents?: SeedEvent[];
  host?: string | null;
}) {
  // Compute the seed exactly once (initialEvents is a stable SSR prop).
  const seedRef = useRef<ReturnType<typeof buildSeed> | null>(null);
  if (seedRef.current === null) seedRef.current = buildSeed(initialEvents);
  const seed = seedRef.current;

  const [artifacts, setArtifacts] = useState<string[]>(seed.artifacts);
  const [facts, setFacts] = useState<PreliminaryFacts | null>(seed.facts);
  const [findingsData, setFindingsData] = useState<FindingsPayload | null>(
    seed.findings
  );
  const [failed, setFailed] = useState<boolean>(
    seed.errored || initialStatus === "failed"
  );

  // Already finished (per the seed or the persisted status)? Nothing to stream.
  const statusActive =
    initialStatus != null && ACTIVE_STATUSES.includes(initialStatus);
  const seededTerminal =
    seed.done || seed.errored || (initialStatus != null && !statusActive);

  useEffect(() => {
    if (!scanExists || seededTerminal) return;

    let cancelled = false;
    let settled = seed.facts != null || seed.findings != null;
    let lastId = seed.lastId;
    let reconnects = 0;
    let es: EventSource | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const overallDeadline = Date.now() + 300_000;

    const cleanup = () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      es?.close();
    };

    // If NOTHING usable ever arrives, surface an error rather than spin forever.
    watchdog = setTimeout(() => {
      if (!settled && !cancelled) {
        setFailed(true);
        cleanup();
      }
    }, 180_000);

    const handle = (e: ScanEvent) => {
      if (e.type === "artifact") {
        setArtifacts((a) => [...a, String(e.payload["label"] ?? "working")]);
      } else if (e.type === "facts") {
        settled = true;
        const f = e.payload as unknown as PreliminaryFacts;
        setFacts(f);
        funnel.factsShown({ scan_id: id, mode: f.mode });
      } else if (e.type === "findings") {
        settled = true;
        const fp = e.payload as unknown as FindingsPayload;
        setFindingsData(fp);
        funnel.findingsShown({ scan_id: id, score: fp.score.total });
      } else if (e.type === "done") {
        settled = true;
        cleanup();
      } else if (e.type === "error") {
        // Reveal whatever we have: the reveal is gated on (findingsData || failed) &&
        // facts, so setting failed surfaces the partial result when facts arrived, or
        // ScanError when nothing did.
        setFailed(true);
        cleanup();
      }
    };

    // Connect (and reconnect) tailing from the last seen event id. A dropped
    // connection (server maxDuration, proxy, transient blip) is NOT a failure —
    // we resume from the cursor; only an `error` event, the watchdog, or budget
    // exhaustion surfaces a failure.
    const connect = () => {
      if (cancelled) return;
      es = new EventSource(`/api/scan/${id}/stream?since=${lastId}`);
      es.onmessage = (m) => {
        const evId = Number(m.lastEventId);
        if (Number.isFinite(evId) && evId > lastId) lastId = evId;
        let parsed: ScanEvent | null = null;
        try {
          parsed = JSON.parse(m.data as string) as ScanEvent;
        } catch {
          return;
        }
        handle(parsed);
      };
      es.onerror = () => {
        es?.close();
        if (cancelled) return;
        if (Date.now() > overallDeadline || reconnects > 200) {
          // Give up reconnecting → reveal whatever we have: failed gates the
          // (findingsData || failed) && facts reveal, or surfaces ScanError if no facts.
          setFailed(true);
          cleanup(); // cancel the watchdog timer too
          return;
        }
        reconnects++;
        setTimeout(connect, 1000);
      };
    };

    connect();
    return cleanup;
    // seed/seededTerminal derive from stable SSR props; intentionally not deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scanExists]);

  if (!scanExists) return <ScanNotFound />;
  if (failed && !facts) return <ScanError />;

  // Reveal (speed-to-wow): the wow — competitor card + score + positioning — is
  // fully carried by the facts + findings events (~40s). Reveal as soon as findings
  // land; the heavy full-scan (action drafting) keeps running in the background for
  // the post-email results page. `done` still closes the SSE loop but no longer
  // gates the reveal. A failure after facts shows the partial result, not a spinner.
  if ((findingsData || failed) && facts) {
    return <FactsView facts={facts} findingsData={findingsData} scanId={id} />;
  }

  // Otherwise we're actively scanning — the live "thinking" narrative + scan
  // animation, continuously moving and synced to the real scan_events.
  return (
    <ScanProgress
      artifacts={artifacts}
      productName={facts?.listing.name ?? null}
      host={host}
      reviewCount={facts?.reviewVolume}
      competitorCount={facts?.competitors.length}
      finished={false}
    />
  );
}

// ── Scan-not-found state — a bad/expired id never shows a hard 404 ─────────────
function ScanNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-6 py-20 text-center">
      <h2
        className="text-2xl font-semibold"
        style={{ color: "var(--color-fg)" }}
      >
        We couldn&apos;t find that scan
      </h2>
      <p
        className="text-base leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        This scan link is invalid or has expired. Start a fresh scan and
        we&apos;ll analyse your product from scratch.
      </p>
      <Link
        href="/scan"
        className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px motion-reduce:transform-none"
        style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
      >
        Start a scan
      </Link>
    </div>
  );
}
