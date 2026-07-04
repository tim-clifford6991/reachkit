"use client";

import { useEffect } from "react";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

const SG = "var(--font-display)", JM = "var(--font-mono)";

/**
 * Deployment-skew signatures: an old tab holding a previous build fails to load
 * a chunk / dynamic import / RSC payload that the new deploy renamed. These are
 * fixed by a single hard reload (fetches the fresh build), not by `reset()`.
 */
const SKEW_RE =
  /ChunkLoadError|Loading chunk [^ ]+ failed|dynamically imported module|Importing a module script failed|Failed to fetch RSC payload/i;
const SKEW_RELOAD_KEY = "rk-skew-reloaded";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console / any attached error reporter.
    console.error(error);

    // One-shot auto-recovery for deployment skew: reload once per session when
    // the error looks like a stale-build asset failure. The sessionStorage flag
    // prevents reload loops if the error persists after a fresh build.
    if (SKEW_RE.test(`${error.name ?? ""} ${error.message ?? ""}`)) {
      try {
        if (!sessionStorage.getItem(SKEW_RELOAD_KEY)) {
          sessionStorage.setItem(SKEW_RELOAD_KEY, "1");
          window.location.reload();
        }
      } catch {
        /* sessionStorage unavailable (privacy mode) — fall through to the UI */
      }
    }
  }, [error]);

  return (
    <main
      style={{ display: "flex", minHeight: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "0 28px", textAlign: "center", background: "var(--c-surface)" }}
    >
      <LogoMark size={44} />
      <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>
        Something went wrong
      </p>
      <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "var(--c-ink)", margin: 0 }}>
        We hit an unexpected error
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.5, color: "var(--c-muted)", margin: 0, maxWidth: 460 }}>
        This one&apos;s on us. Try again — if it keeps happening, head back home and give it a moment.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 6 }}>
        <button
          type="button"
          onClick={reset}
          style={{ display: "inline-block", background: "var(--c-action)", color: "#fff", borderRadius: 10, padding: "11px 20px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{ display: "inline-block", background: "var(--c-surface)", border: "1px solid var(--c-line)", color: "var(--c-ink)", borderRadius: 10, padding: "11px 20px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
