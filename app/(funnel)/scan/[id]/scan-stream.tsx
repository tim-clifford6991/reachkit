"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PreliminaryFacts, ScanEvent } from "@/lib/scan/types";
import type {
  Finding,
  ScoreResult,
  PositioningMirror,
  SampleAction,
} from "@/lib/llm/types";
import { funnel } from "@/lib/analytics";
import { ScanProgress } from "@/components/scan/scan-progress";
import { shouldHandOffToResults, type ScanTier } from "./handoff";

export interface FindingsPayload {
  score: ScoreResult;
  positioningMirror: PositioningMirror;
  findings: Finding[];
  /** Absent on payloads persisted before the sample-action step existed. */
  sampleAction?: SampleAction;
}

// ── Design idiom: intel-kit — inline styles + `--c-*` tokens + the three fonts ─
const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";
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

// ── Error states ─────────────────────────────────────────────────────────────

function ScanError() {
  return (
    <div style={{ maxWidth: 448, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "80px 24px", textAlign: "center", fontFamily: PJ }}>
      <span
        style={{ width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--c-tint-red)", color: "var(--color-danger)" }}
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

// Partial failure: we gathered facts before the run errored, but there's no
// full report to show. Rather than render a stale teaser, just say so and
// point back to a fresh scan.
function PartialResult({ host }: { host: string | null }) {
  return (
    <div style={{ maxWidth: 448, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "80px 24px", textAlign: "center", fontFamily: PJ }}>
      <span
        style={{ width: 48, height: 48, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--c-tint-red)", color: "var(--color-danger)" }}
        aria-hidden
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
      <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: 0 }}>
        We gathered partial results{host ? ` for ${host}` : ""}
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: 0 }}>
        The scan didn&apos;t finish, so we can&apos;t show a full result. This is on us — please
        try running the scan again.
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

  // Single results experience, ONE url: once the result is actually ready,
  // refresh this SAME route so the server component re-reads the scan and
  // swaps in <PublicReport> — no navigation, no /results redirect. Free scans
  // END at findings (the teaser reads findings_payload); full scans must wait
  // for the deep pass to persist report_payload (~80s later) — refreshing on
  // findings alone would just re-render this same live view since
  // report_payload isn't there yet. Failures stay here to show the error inline.
  const handOff = shouldHandOffToResults({
    tier,
    findingsReady: findingsData != null,
    reportReady,
    failed,
  });
  useEffect(() => {
    if (handOff) router.refresh();
  }, [handOff, router]);

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

  // Partial failure (we gathered facts but the run errored): there's no report
  // to show, so say so inline rather than bouncing to a page with no data.
  if (failed && facts) {
    return <PartialResult host={host} />;
  }

  // Ready → we're refreshing this SAME url (see the effect above) so the
  // server component swaps in <PublicReport>. Brief placeholder while that
  // resolves. `handOff` is false for a full scan until report_payload lands,
  // so the live narrative below keeps running through the deep pass.
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

// ── Hand-off placeholder — shown for the instant before the same-url refresh ──
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
