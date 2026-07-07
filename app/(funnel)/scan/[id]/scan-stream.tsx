"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PreliminaryFacts, ScanEvent } from "@/lib/scan/types";
import type { FindingsPayload } from "./findings-reveal";
import { funnel } from "@/lib/analytics";
import { competitorSourceLabel } from "@/lib/scan/source-labels";
import { ScanProgress } from "@/components/scan/scan-progress";
import { shouldHandOffToResults, type ScanTier } from "./handoff";

// ── Design idiom: intel-kit — inline styles + `--c-*` tokens + the three fonts ─
const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";
const CARD: React.CSSProperties = {
  background: "var(--c-surface)",
  border: "1px solid var(--c-line)",
  borderRadius: 14,
  padding: "24px 26px",
};
const EYEBROW: React.CSSProperties = {
  fontFamily: JM,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--c-faint)",
  margin: 0,
};
const CTA_LINK: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 44,
  background: "var(--c-action)",
  color: "var(--c-on-dark)",
  fontFamily: PJ,
  fontWeight: 600,
  fontSize: 13.5,
  padding: "0 20px",
  borderRadius: 12,
  textDecoration: "none",
};

// Lazy-load the entire findings reveal (includes Motion + TrialCta + base-ui)
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
    <div style={{ maxWidth: 672, margin: "0 auto", padding: 32, display: "flex", flexDirection: "column", gap: 20, fontFamily: PJ, color: "var(--c-ink)" }}>
      {/* ── Product header ──────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 19, lineHeight: 1.25, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {facts.listing.name}
            </h1>
            {facts.listing.category != null && (
              <p style={{ fontSize: 13.5, color: "var(--c-muted)", margin: "2px 0 0" }}>
                {facts.listing.category}
              </p>
            )}
          </div>
          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", background: "var(--c-fill)", color: "var(--c-muted)", fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: 6, textTransform: "capitalize", whiteSpace: "nowrap" }}>
            {facts.mode}
          </span>
        </div>

        {facts.listing.description != null && (
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--c-muted)", margin: "12px 0 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {facts.listing.description}
          </p>
        )}
      </div>

      {/* ── Signal metrics ───────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 1, borderRadius: 14, border: "1px solid var(--c-line)", overflow: "hidden", background: "var(--c-line)" }}>
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
        <div style={CARD}>
          <h2 style={{ ...EYEBROW, marginBottom: 4 }}>Your competitive landscape</h2>
          <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: "0 0 16px" }}>
            Who shows up where your category buyers look:
          </p>
          <ul style={{ display: "flex", flexDirection: "column", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>
            {facts.competitors.slice(0, 5).map((c, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: 13.5 }}>
                <span style={{ marginTop: 2, width: 20, height: 20, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", fontFamily: JM, fontSize: 10, background: "var(--c-fill)", color: "var(--c-muted)" }}>
                  {c.rank}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: "var(--c-ink)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.name}
                  </p>
                  <p style={{ fontSize: 12, lineHeight: 1.4, color: "var(--c-faint)", margin: 0 }}>
                    {competitorSourceLabel(c.source)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {facts.competitors.length > 5 && (
            <p style={{ fontFamily: JM, fontSize: 12, color: "var(--c-muted)", margin: "12px 0 0" }}>
              +{facts.competitors.length - 5} more mapped in your full report
            </p>
          )}
        </div>
      )}

      {/* ── Theme chips ──────────────────────────────────────────────────── */}
      {facts.themes.length > 0 && (
        <div style={CARD}>
          <h2 style={{ ...EYEBROW, marginBottom: 4 }}>What buyers care about</h2>
          <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: "0 0 12px" }}>
            From {facts.reviewVolume} reviews — the language your buyers use:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {facts.themes.slice(0, 10).map((t, i) => (
              <span
                key={i}
                style={{ border: "1px solid var(--c-line)", borderRadius: 999, padding: "2px 10px", fontFamily: JM, fontSize: 12, color: "var(--c-muted)" }}
              >
                {t.term}
                <span style={{ marginLeft: 6, color: "var(--c-faint)" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 16, background: "var(--c-surface)" }}>
      <span style={EYEBROW}>{label}</span>
      <span style={{ fontFamily: JM, fontSize: 20, fontWeight: 700, lineHeight: 1.25, color: "var(--c-ink)" }}>
        {value}
      </span>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ScanError() {
  return (
    <div style={{ maxWidth: 448, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "80px 24px", textAlign: "center", fontFamily: PJ }}>
      <span
        style={{ width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--c-tint-red)", color: "#E5484D" }}
        aria-hidden
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
      <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: 0 }}>
        This scan didn&apos;t finish
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: 0 }}>
        Something went wrong while analysing your product, or it took too long. This is on us —
        please try running the scan again.
      </p>
      <Link href="/scan" style={CTA_LINK}>
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
  let reported = false;
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
    } else if (e.type === "report") {
      reported = true;
    } else if (e.type === "done") {
      done = true;
    } else if (e.type === "error") {
      errored = true;
    }
  }
  return { artifacts, facts, findings, reported, done, errored, lastId };
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
  tier = "free",
  scanExists = true,
  initialStatus = null,
  initialEvents = [],
  host = null,
}: {
  id: string;
  /** Two-track split: 'full' scans run the deep pass; 'free' stops at findings. */
  tier?: ScanTier;
  scanExists?: boolean;
  initialStatus?: string | null;
  initialEvents?: SeedEvent[];
  host?: string | null;
}) {
  // Compute the seed exactly once (initialEvents is a stable SSR prop).
  const [seed] = useState(() => buildSeed(initialEvents));

  const [artifacts, setArtifacts] = useState<string[]>(seed.artifacts);
  const [facts, setFacts] = useState<PreliminaryFacts | null>(seed.facts);
  const [findingsData, setFindingsData] = useState<FindingsPayload | null>(
    seed.findings
  );
  // Report persisted (deep pass done). Full scans hand off on this; free never reach it.
  const [reportReady, setReportReady] = useState<boolean>(seed.reported || seed.done);
  const [failed, setFailed] = useState<boolean>(
    seed.errored || initialStatus === "failed"
  );

  // Already finished (per the seed or the persisted status)? Nothing to stream.
  const statusActive =
    initialStatus != null && ACTIVE_STATUSES.includes(initialStatus);
  const seededTerminal =
    seed.done || seed.errored || (initialStatus != null && !statusActive);

  const router = useRouter();

  // Single results experience: hand off to the canonical /scan/[id]/results page
  // once its data is actually ready. Free scans END at findings (the teaser reads
  // findings_payload); full scans must wait for the deep pass to persist
  // report_payload (~80s later) — handing off on findings drops the user on the
  // "Finalising your action plan…" pending screen for the whole pass. Failures
  // stay here to show the error inline.
  const handOff = shouldHandOffToResults({
    tier,
    findingsReady: findingsData != null,
    reportReady,
    failed,
  });
  useEffect(() => {
    if (handOff) router.replace(`/scan/${id}/results`);
  }, [handOff, id, router]);

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
      } else if (e.type === "report") {
        // Deep pass finished — report_payload is persisted (full scans hand off here).
        settled = true;
        setReportReady(true);
      } else if (e.type === "done") {
        settled = true;
        setReportReady(true);
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

  // Partial failure (we gathered facts but the run errored): show what we have
  // inline rather than bouncing to a results page that may have no data.
  if (failed && facts) {
    return <FactsView facts={facts} findingsData={findingsData} scanId={id} />;
  }

  // Ready → we're handing off to /scan/[id]/results (the single results
  // experience; see the effect above). Brief placeholder while the route
  // transition happens. `handOff` is false for a full scan until report_payload
  // lands, so the live narrative below keeps running through the deep pass.
  if (handOff && facts) {
    return <PreparingResults />;
  }

  // Otherwise we're actively scanning — the live "thinking" narrative + scan
  // animation, continuously moving and synced to the real scan_events. Full scans
  // continue through the deep pass (actions → critic → report) instead of handing
  // off at findings, so the user sees ONE loading screen, then the ready report.
  return (
    <ScanProgress
      artifacts={artifacts}
      productName={facts?.listing.name ?? null}
      host={host}
      reviewCount={facts?.reviewVolume}
      competitorCount={facts?.competitors.length}
      deep={tier === "full"}
      findingsReady={findingsData != null}
      reportReady={reportReady}
    />
  );
}

// ── Hand-off placeholder — shown for the instant before routing to /results ───
function PreparingResults() {
  return (
    <div style={{ maxWidth: 448, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "96px 24px", textAlign: "center" }}>
      <style>{`@keyframes rk-ping{75%,100%{transform:scale(2.4);opacity:0}}`}</style>
      <span style={{ position: "relative", display: "flex", width: 10, height: 10 }} aria-hidden="true">
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--c-action)", opacity: 0.75, animation: "rk-ping 1s cubic-bezier(0,0,0.2,1) infinite" }} />
        <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: "var(--c-action)" }} />
      </span>
      <p style={{ fontFamily: JM, fontSize: 13.5, letterSpacing: "0.025em", color: "var(--c-muted)", margin: 0 }}>
        Preparing your report…
      </p>
    </div>
  );
}

// ── Scan-not-found state — a bad/expired id never shows a hard 404 ─────────────
function ScanNotFound() {
  return (
    <div style={{ maxWidth: 448, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "80px 24px", textAlign: "center", fontFamily: PJ }}>
      <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: 0 }}>
        We couldn&apos;t find that scan
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: 0 }}>
        This scan link is invalid or has expired. Start a fresh scan and
        we&apos;ll analyse your product from scratch.
      </p>
      <Link href="/scan" style={CTA_LINK}>
        Start a scan
      </Link>
    </div>
  );
}
