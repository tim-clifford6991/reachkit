"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-scoped error boundary for the /app workspace. Keeps the app shell (nav)
 * rendered while showing a compact, retryable error in place of the page —
 * instead of the full-page global boundary (app/error.tsx) blanking everything.
 *
 * Auth failures (expired session) no longer reach here: currentUser() catches
 * getUser() rejections and resolveIntelContext redirects to /login. This is
 * defense in depth for a data-shaped throw inside an /app page.
 *
 * IMPORTANT: this SEGMENT boundary catches /app errors BEFORE the global
 * app/error.tsx does, so it must own the deployment-skew auto-recovery itself —
 * otherwise a stale-build chunk/RSC failure on a soft nav (e.g. clicking the logo
 * → /app → /app/dashboard right after a deploy) shows a scary "hit a snag" that
 * only clears after the user manually retries into the global boundary. We mirror
 * the global boundary's one-shot reload here so it self-heals silently.
 *
 * "Connection closed" is the same class of transient failure surfaced differently:
 * Next aborts the in-flight RSC stream when the soft-nav request races a deploy (or
 * a network blip), and the aborted fetch bubbles to this boundary. A one-shot reload
 * re-requests against the live deployment and recovers — matching the skew path.
 */
const SKEW_RE =
  /ChunkLoadError|Loading chunk [^ ]+ failed|dynamically imported module|Importing a module script failed|Failed to fetch RSC payload|Connection closed/i;
const SKEW_RELOAD_KEY = "rk-skew-reloaded";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
    // One-shot auto-recovery for deployment skew (stale-build asset/RSC failure):
    // reload once per session so the user never sees the error page for a transient
    // build mismatch. sessionStorage flag prevents a reload loop if it persists.
    if (SKEW_RE.test(`${error.name ?? ""} ${error.message ?? ""}`)) {
      try {
        if (!sessionStorage.getItem(SKEW_RELOAD_KEY)) {
          sessionStorage.setItem(SKEW_RELOAD_KEY, "1");
          window.location.reload();
        }
      } catch {
        /* sessionStorage unavailable — fall through to the retry UI */
      }
    }
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
