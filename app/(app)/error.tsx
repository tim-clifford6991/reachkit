"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-scoped error boundary for the /app workspace. Keeps the app shell (nav)
 * rendered while showing a compact, retryable error in place of the page —
 * instead of the full-page global boundary (app/error.tsx) blanking everything.
 *
 * Auth failures (expired session) no longer reach here: currentUser() catches
 * getUser() rejections and resolveIntelContext redirects to /login. Deployment
 * skew is handled by the global boundary's one-shot reload. This is defense in
 * depth for a data-shaped throw inside an /app page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 14, padding: "64px 24px", textAlign: "center", minHeight: 320,
      }}
    >
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>
        This view hit a snag
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.5, color: "var(--c-muted)", margin: 0, maxWidth: 420 }}>
        We couldn&apos;t render this page from the current data. Retry, or head back to your dashboard.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
        <button
          type="button"
          onClick={reset}
          style={{ background: "var(--c-action)", color: "#fff", borderRadius: 10, padding: "10px 18px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
        >
          Try again
        </button>
        <Link
          href="/app/dashboard"
          style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", color: "var(--c-ink)", borderRadius: 10, padding: "10px 18px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
