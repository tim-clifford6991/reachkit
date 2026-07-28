"use client";

/**
 * Setup overlay · Build step — "building your data". Shows the REAL deep-scan
 * checklist (visual) and navigates to the dashboard ONLY when the DEEP pass is
 * complete — so onboarding shows ONE loading and the dashboard, when reached, has
 * no second one.
 *
 * Navigation gates on the DEEP SENTINEL, not on an SSE event: it POLLS
 * `deepScanCursor(...).deepComplete` (← `scans.deepened_at`, invariant #10) and
 * calls `onComplete` only when the deep pass has finished (or failed — never trap).
 * The `DashboardScanProgress` checklist is rendered purely for the visual and its
 * `onDone` is a no-op.
 *
 * Two-loading-screens bug (v1 2026-07-28, v2 same day): v1 watched the SUPPLY
 * gather with a 90s timeout < the ~165s deep scan → navigated mid-scan. v2 watched
 * `DashboardScanProgress` and navigated on the next SSE `done` past a cursor
 * snapshot — but a tier=full scan emits TWO `done`s (free pass, then deep pass),
 * and the competitor pick can mount this step BEFORE the free `done` is written, so
 * the cursor was 0 and the step fired on the FREE `done` (id 1307, 99s before the
 * deep `done` id 1318 — verified on scan 61d01cd4), dropping the user on the
 * dashboard mid-deep-scan. The fix: gate on `deepened_at`, which is NULL through
 * the entire free+deep-in-progress window and set exactly once at deep completion —
 * race-free regardless of when this step mounts. `hasDomain=false` (no scanned app)
 * settles after a short beat — there's nothing to build.
 */

import { useEffect, useRef, useState } from "react";
import { DashboardScanProgressLazy as DashboardScanProgress } from "@/components/app/dashboard-scan-progress-lazy";
import { deepScanCursor } from "@/app/(app)/app/onboarding/actions";

const SG = "var(--font-display)", PJ = "var(--font-sans)";

type Cursor = { scanId: string; sinceId: number };

// The deep scan is bounded to ~300s (maxDuration); never trap the user past that.
const DEEP_DEADLINE_MS = 330_000;
const POLL_MS = 2_500;

export function SetupCalculatingStep({
  hasDomain,
  scanId = null,
  host = null,
  onComplete,
}: {
  hasDomain: boolean;
  /** The add flow's scan id (known); null on first-run → resolve the active app's. */
  scanId?: string | null;
  host?: string | null;
  onComplete: () => void;
}) {
  // undefined = resolving · null = nothing to watch · Cursor = watch it (visual only).
  // Seed from hasDomain (stable per mount) so the no-app case needs no in-effect
  // setState (which cascades renders — lint-enforced).
  const [cursor, setCursor] = useState<Cursor | null | undefined>(hasDomain ? undefined : null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // POLL the deep sentinel and navigate ONLY when the DEEP pass is complete
  // (`deepComplete` ← scans.deepened_at, invariant #10). We must NOT navigate on an
  // SSE `done`: a tier=full scan emits a `done` for the FREE pass first, and the
  // competitor pick can mount this step before that free `done` is even written, so
  // tailing "the next done" fired early and dropped the user on the dashboard while
  // the deep pass was still running (the two-loading-screens bug, 2026-07-28). The
  // checklist below is VISUAL only — its own onDone is a no-op.
  useEffect(() => {
    if (!hasDomain) return; // nothing to watch; cursor already seeded null
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const tick = async () => {
      if (!alive) return;
      try {
        const c = await deepScanCursor(scanId);
        if (!alive) return;
        if (!c) { setCursor(null); return; } // no scan to watch → settle path below
        // Set the visual cursor ONCE (keep the first sinceId so the checklist
        // doesn't remount on every poll).
        setCursor((prev) => (prev ? prev : { scanId: c.scanId, sinceId: c.sinceId }));
        if (c.deepComplete) { onCompleteRef.current(); return; }
      } catch { /* transient — keep polling */ }
      if (Date.now() - startedAt > DEEP_DEADLINE_MS) { onCompleteRef.current(); return; }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [hasDomain, scanId]);

  // Nothing to watch (no app, or the lookup found no scan) → settle after a beat.
  useEffect(() => {
    if (cursor !== null) return; // undefined = still resolving; Cursor = watching
    const t = setTimeout(() => onCompleteRef.current(), 1500);
    return () => clearTimeout(t);
  }, [cursor]);

  if (cursor) {
    return (
      <DashboardScanProgress
        scanId={cursor.scanId}
        tier="full"
        host={host}
        sinceId={cursor.sinceId}
        refreshing
        onDone={() => {}}
      />
    );
  }

  // Resolving the cursor, or nothing to build — a brief calm beat.
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 0 8px" }}>
      <style>{`@keyframes rk-build-spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ width: 26, height: 26, borderRadius: "var(--radius-full)", border: "3px solid var(--c-soft)", borderTopColor: "var(--c-action)", animation: "rk-build-spin 0.8s linear infinite", display: "inline-block" }} />
      <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 22, color: "var(--c-ink)", margin: "16px 0 0" }}>
        Building your data…
      </h1>
      <p style={{ fontFamily: PJ, fontSize: 13.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "8px 0 0", maxWidth: 420 }}>
        Benchmarking you against your chosen competitors. The first pass takes a minute; after this it&apos;s instant.
      </p>
    </div>
  );
}
