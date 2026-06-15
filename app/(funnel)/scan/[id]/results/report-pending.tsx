"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Shown when the results page is reached before the background full-scan has
 * persisted report_payload (a fast user beating the deferred action drafting).
 * Soft-refreshes (RSC re-render, no hard reload/flicker) until the report lands.
 */
export function ReportPending() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);
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
