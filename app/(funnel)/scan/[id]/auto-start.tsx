"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

/**
 * Lazy auto-start: opening /scan/<domain> for an un-scanned domain kicks off a
 * FREE scan — but only here, in the browser. Link-unfurlers / crawlers that
 * don't run JS never mount this, so a shared link costs nothing until a human
 * opens it. Idempotent: /api/scan find-or-creates, and the ref guards re-fire.
 */
export function AutoStart({ domain }: { domain: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Fire exactly once. The `started` ref (not a per-invocation `cancelled`
    // flag) is the guard: under dev StrictMode the mount→cleanup→remount double
    // invoke early-returns on the second pass, so the POST fires once. We do NOT
    // gate router.refresh()/setFailed on a cleanup flag — a StrictMode cleanup
    // would poison the first closure and suppress the refresh, leaving the user
    // stuck on "Starting…". A stray refresh after a real unmount is harmless
    // (a client route re-resolve, no state mutation).
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store_url: domain }),
        });
        if (!res.ok) throw new Error(String(res.status));
        router.refresh(); // re-resolve → the new scan streams live
      } catch {
        setFailed(true);
      }
    })();
  }, [domain, router]);

  if (failed) {
    return (
      <div style={{ maxWidth: 448, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "80px 24px", textAlign: "center", fontFamily: PJ }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: 0 }}>
          We couldn&apos;t start that scan
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: 0 }}>
          Something went wrong kicking off the scan for {domain}. Please try again.
        </p>
        <Link href="/scan" style={CTA_LINK}>
          Try again
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 672, margin: "0 auto", padding: 32 }}>
      <style>{`@keyframes rk-ping{75%,100%{transform:scale(2.4);opacity:0}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ position: "relative", marginTop: 2, display: "flex", width: 8, height: 8, flexShrink: 0 }} aria-hidden="true">
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--c-action)", opacity: 0.75, animation: "rk-ping 1s cubic-bezier(0,0,0.2,1) infinite" }} />
          <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, borderRadius: "50%", background: "var(--c-action)" }} />
        </span>
        <p style={{ fontFamily: JM, fontSize: 13.5, letterSpacing: "0.025em", color: "var(--c-muted)", margin: 0 }}>
          Starting your scan for {domain}…
        </p>
      </div>
    </div>
  );
}
