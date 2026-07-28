"use client";

/**
 * Setup overlay · Build step — "building your data". Shows the REAL deep-scan
 * progress (the same checklist the dashboard uses) and finishes ONLY when the
 * deep pass completes — so onboarding shows ONE loading and the dashboard, when
 * reached, has no second one.
 *
 * It resolves the deep-scan resume cursor (`deepScanCursor` — scan id + the
 * event-id past the free pass's `done`), then watches `DashboardScanProgress`
 * until the DEEP `done`, at which point `onDone` → `onComplete` navigates to the
 * now-ready dashboard.
 *
 * Regression fixed (2026-07-28): the old step watched the SUPPLY gather with a
 * 90s soft-timeout, but the deep scan takes ~165s — so it navigated mid-scan and
 * the dashboard showed a SECOND "Refreshing" loading. `hasDomain=false` (no
 * scanned app) settles after a short beat — there's nothing to build.
 */

import { useEffect, useState } from "react";
import { DashboardScanProgressLazy as DashboardScanProgress } from "@/components/app/dashboard-scan-progress-lazy";
import { deepScanCursor } from "@/app/(app)/app/onboarding/actions";

const SG = "var(--font-display)", PJ = "var(--font-sans)";

type Cursor = { scanId: string; sinceId: number };

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
  // undefined = resolving the cursor · null = nothing to watch · Cursor = watch it.
  // Seed from hasDomain (stable per mount) so the no-app case needs no in-effect
  // setState (which cascades renders — lint-enforced).
  const [cursor, setCursor] = useState<Cursor | null | undefined>(hasDomain ? undefined : null);

  useEffect(() => {
    if (!hasDomain) return; // nothing to watch; cursor already seeded null
    let alive = true;
    deepScanCursor(scanId)
      .then((c) => { if (alive) setCursor(c); })
      .catch(() => { if (alive) setCursor(null); });
    return () => { alive = false; };
  }, [hasDomain, scanId]);

  // Nothing to watch (no app, or the lookup found no scan) → settle after a beat.
  useEffect(() => {
    if (cursor !== null) return; // undefined = still resolving; Cursor = watching
    const t = setTimeout(onComplete, 1500);
    return () => clearTimeout(t);
  }, [cursor, onComplete]);

  if (cursor) {
    return (
      <DashboardScanProgress
        scanId={cursor.scanId}
        tier="full"
        host={host}
        sinceId={cursor.sinceId}
        refreshing
        onDone={onComplete}
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
