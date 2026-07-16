/**
 * LandingFinalCta — the landing page's closing band, lifted OUT of the captured
 * HTML so the CTA is a REAL scan entry: the shared <ScanInput/> (same component
 * as the hero and /scan), not a decorative button. Owner feedback 2026-07-16:
 * the captured bottom "Analyze my site" button did nothing, and the visitor
 * should never have to scroll back to the hero just to type their URL.
 *
 * Server component. Layout/tokens match the captured section it replaces 1:1
 * (surface band · centred 26px display heading · muted reassurance line).
 * autoFocus MUST stay false — only the hero input grabs focus on page load.
 */

import { ScanInput } from "@/app/(marketing)/scan-input";

export function LandingFinalCta() {
  return (
    <section style={{ background: "var(--c-surface)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "52px 28px", textAlign: "center" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 8px", color: "var(--c-ink)" }}>
          Stop guessing where you stand.
        </h3>
        <p style={{ fontSize: 15, color: "var(--c-muted)", margin: "0 0 20px" }}>
          Your first scan is free and takes under a minute — then it&apos;s a number you can move, week after week.
        </p>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "left" }}>
          <ScanInput autoFocus={false} />
        </div>
      </div>
    </section>
  );
}
