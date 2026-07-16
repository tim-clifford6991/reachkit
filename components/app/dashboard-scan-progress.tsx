"use client";

/**
 * DashboardScanProgress — in-shell live scan progress for the dashboard's
 * empty state, when the active app's latest scan is in-flight (spec §4,
 * docs/superpowers/specs/2026-07-15-add-product-onboarding-design.md).
 *
 * Reuses the shared, presentational <ScanProgress> renderer (components/scan/
 * scan-progress.tsx, `embedded` mode — no full-page takeover) fed by a small
 * SSE client against the existing /api/scan/[id]/stream endpoint. Same wiring
 * idiom as the funnel's ScanStream (app/(funnel)/scan/[id]/scan-stream.tsx)
 * and components/app/intel/shared.tsx's useIntel, deliberately stripped down:
 * no funnel handoff, no results screen, no findings teaser CTA — this never
 * renders PublicReport or links to /scan/<id>, it just watches the checklist
 * fill in, then hands back to the server.
 *
 * Refresh timing: we wait for the `done` event (not `report`) before calling
 * router.refresh(). `report` fires mid-pipeline, a full Inngest step BEFORE
 * `scans.completed_at` is written; refreshing then would race the dashboard's
 * `completed_at IS NOT NULL` read and could bounce back through this same
 * in-flight view for another beat. `done` fires immediately before that same
 * write (same step, no boundary in between) — refreshing on it is safe.
 *
 * The app shell (sidebar, switcher, other products) lives OUTSIDE this
 * component, in the (app) layout — never touched here, so product #1 stays
 * one click away while this watches product #2.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScanEvent } from "@/lib/scan/types";
import { ScanProgress } from "@/components/scan/scan-progress";

export function DashboardScanProgress({
  scanId,
  tier,
  host = null,
}: {
  scanId: string;
  /** Two-track split, mirroring the funnel: 'full' scans run the deep pass. */
  tier: "free" | "full";
  host?: string | null;
}) {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [findingsReady, setFindingsReady] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let lastId = 0;
    let reconnects = 0;
    let es: EventSource | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const overallDeadline = Date.now() + 300_000;

    const cleanup = () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      es?.close();
    };

    // If NOTHING usable ever arrives, degrade honestly rather than spin forever
    // (mirrors ScanStream's watchdog — never fake progress).
    watchdog = setTimeout(() => {
      if (!settled && !cancelled) {
        setFailed(true);
        cleanup();
      }
    }, 180_000);

    const handle = (e: ScanEvent) => {
      if (e.type === "artifact") {
        settled = true;
        setArtifacts((a) => [...a, String(e.payload["label"] ?? "working")]);
      } else if (e.type === "facts") {
        settled = true;
      } else if (e.type === "findings") {
        settled = true;
        setFindingsReady(true);
      } else if (e.type === "report") {
        settled = true;
        setReportReady(true);
      } else if (e.type === "done") {
        settled = true;
        setFindingsReady(true);
        setReportReady(true);
        setDone(true);
        cleanup();
      } else if (e.type === "error") {
        setFailed(true);
        cleanup();
      }
    };

    // Connect (and reconnect) tailing from the last seen event id — a dropped
    // connection is not a failure, we resume from the cursor.
    const connect = () => {
      if (cancelled) return;
      es = new EventSource(`/api/scan/${scanId}/stream?since=${lastId}`);
      es.onmessage = (m) => {
        const evId = Number(m.lastEventId);
        if (Number.isFinite(evId) && evId > lastId) lastId = evId;
        try {
          handle(JSON.parse(m.data as string) as ScanEvent);
        } catch {
          /* ignore malformed frame */
        }
      };
      es.onerror = () => {
        es?.close();
        if (cancelled) return;
        if (Date.now() > overallDeadline || reconnects > 200) {
          setFailed(true);
          cleanup();
          return;
        }
        reconnects++;
        setTimeout(connect, 1000);
      };
    };

    connect();
    return cleanup;
  }, [scanId]);

  // Pipeline is DONE — reveal the real dashboard in place.
  useEffect(() => {
    if (done) router.refresh();
  }, [done, router]);

  if (failed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "48px 24px",
          textAlign: "center",
          border: "1px dashed var(--c-line)",
          borderRadius: "var(--radius-xl)",
          background: "var(--c-surface)",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-danger)", margin: 0 }}>
          This scan hit a snag.
        </p>
        <p style={{ fontSize: 12.5, color: "var(--c-muted)", margin: 0, maxWidth: 360 }}>
          Nothing to show yet — check again, or start a fresh scan from here.
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          style={{
            marginTop: 6,
            background: "var(--c-action)",
            color: "var(--c-on-dark)",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 13,
            padding: "8px 14px",
            borderRadius: "var(--radius-lg)",
            border: "none",
            cursor: "pointer",
          }}
        >
          Check again
        </button>
      </div>
    );
  }

  return (
    <ScanProgress
      artifacts={artifacts}
      host={host}
      deep={tier === "full"}
      findingsReady={findingsReady}
      reportReady={reportReady}
      embedded
    />
  );
}
