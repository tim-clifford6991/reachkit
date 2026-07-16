"use client";

/**
 * Client-side lazy boundary for DashboardScanProgress — same pattern as
 * week-plan-preview-lazy.tsx. The dashboard route sits at a razor-thin bundle
 * margin (KNOWN_OVERAGES_KB pins it at 283 KB, scripts/check-bundle.mjs); a
 * static import of the SSE client + ScanProgress + its narrative hook would
 * tip it over. A dynamic import truly code-splits that chunk out of the
 * dashboard's first load — it only downloads when an in-flight scan is
 * actually being watched.
 *
 * The loading fallback reserves roughly the same footprint as the dashed
 * empty-state box it replaces, so there's no layout shift while the chunk
 * loads.
 */
import dynamic from "next/dynamic";

export const DashboardScanProgressLazy = dynamic(
  () => import("./dashboard-scan-progress").then((m) => m.DashboardScanProgress),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        style={{ minHeight: 320, border: "1px dashed var(--c-line)", borderRadius: "var(--radius-xl)", background: "var(--c-surface)" }}
      />
    ),
  },
);
