"use client";

import { useEffect } from "react";

/**
 * Shown when the results page is reached before the background full-scan has
 * persisted report_payload (a fast user beating the deferred action drafting).
 * Self-refreshes so the report appears without a manual reload.
 */
export function ReportPending() {
  useEffect(() => {
    const t = setInterval(() => window.location.reload(), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="rounded-xl border p-8 text-center"
      style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        Finalising your action plan — this page refreshes automatically…
      </p>
    </div>
  );
}
