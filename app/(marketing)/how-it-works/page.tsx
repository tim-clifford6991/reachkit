/**
 * /how-it-works — clean static Claude Design page (flat cards, Space Grotesk,
 * violet). Replaces the old GSAP-pinned scroll modules that rendered blank.
 * Keeps the HowTo JSON-LD + the real ScanInput in the CTA.
 */

import type { Metadata } from "next";
import { buildMetadata, howToLd } from "@/lib/seo";
import { ScanInput } from "@/app/(marketing)/scan-input";

export const metadata: Metadata = buildMetadata({
  title: "How it works",
  description:
    "How ReachKit works: scan your App Store listing or website, read a four-question report, and work a weekly, verified action queue. From URL to action list in ~90 seconds.",
  path: "/how-it-works",
});

const HOW_TO_LD = howToLd({
  name: "How ReachKit works",
  description: "Scan your product, read your Discoverability report, and work a weekly action queue.",
  steps: [
    { name: "Scan", text: "Paste your App Store URL or website. ReachKit fetches it and scores 18 discoverability signals in about 90 seconds." },
    { name: "Report", text: "Read a four-question report: what you offer, who it's for, where they are, and what to fix first — grounded in your live page." },
    { name: "Engine", text: "Paid plans unlock a weekly, prioritised action queue that verifies each fix and tracks your score over time." },
  ],
});

const SG = "var(--font-display)", JM = "var(--font-mono)";

const STEPS = [
  { n: "01", title: "Scan your live page", body: "Paste your App Store URL or website. ReachKit fetches the real page and scores 18 discoverability signals — in about 90 seconds, no account for your first scan.", tag: "~90 seconds" },
  { n: "02", title: "Read the four-question report", body: "What you offer, who it's for, where they are, and what to fix first — every claim grounded in evidence from your live page, plus your positioning gap.", tag: "Grounded in evidence" },
  { n: "03", title: "Work the weekly action engine", body: "Paid plans turn the report into a small, ranked weekly queue. Mark a fix done, ReachKit re-reads your page and verifies the move — your score tracks over time.", tag: "Verified, not vanity" },
];

export default function HowItWorksPage() {
  return (
    <main aria-label="How ReachKit works" style={{ background: "#fff" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_LD) }} />

      {/* Hero */}
      <section style={{ position: "relative", overflow: "hidden", background: "radial-gradient(1100px 480px at 50% -8%, #F2EEFF 0%, rgba(242,238,255,0) 62%), #fff" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 28px 40px", textAlign: "center" }}>
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6E56F7", margin: 0 }}>How it works</p>
          <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2.1rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "#14131A", margin: "16px auto 0", maxWidth: 800 }}>
            From a URL to a ranked action list — in about 90 seconds
          </h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "#56535F", margin: "18px auto 0", maxWidth: 580 }}>
            No agency, no audit deck, no guesswork. ReachKit reads your live product page and hands you a score and the specific fixes that move it.
          </p>
        </div>
      </section>

      {/* Three steps */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 18, padding: "26px 26px 24px" }}>
              <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 28, color: "#6E56F7", letterSpacing: "-0.02em" }}>{s.n}</div>
              <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", color: "#14131A", margin: "14px 0 8px" }}>{s.title}</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#56535F", margin: 0 }}>{s.body}</p>
              <span style={{ display: "inline-block", marginTop: 16, fontFamily: JM, fontSize: 11, fontWeight: 600, color: "#6E56F7", background: "#F2EEFF", padding: "5px 11px", borderRadius: 7 }}>{s.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 90px" }}>
        <div style={{ background: "linear-gradient(135deg, #14131A, #262236)", borderRadius: 22, padding: "44px 32px", textAlign: "center" }}>
          <p style={{ fontFamily: JM, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B7B4C4", margin: 0 }}>Free, no account needed</p>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.6rem, 3vw, 2.3rem)", letterSpacing: "-0.02em", color: "#fff", margin: "12px auto 8px", maxWidth: 520 }}>See it on your own product</h2>
          <p style={{ fontSize: 15.5, color: "#B7B4C4", margin: "0 auto 22px", maxWidth: 460 }}>Paste your URL and get your Discoverability Score and ranked action list in ~90 seconds.</p>
          <div style={{ maxWidth: 540, margin: "0 auto", textAlign: "left" }}>
            <ScanInput />
          </div>
        </div>
      </section>
    </main>
  );
}
