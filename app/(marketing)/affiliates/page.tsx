import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Affiliate program",
  description:
    "Earn recurring commission recommending ReachKit to the founders and indie hackers in your audience.",
  path: "/affiliates",
});

const SG = "var(--font-display)", JM = "var(--font-mono)";

const POINTS = [
  {
    title: "Recurring commission",
    body: "Earn a share of every subscription you refer, for as long as they stay — not just the first month.",
  },
  {
    title: "Made to convert",
    body: "A free scan is a genuinely useful first touch, so your audience gets value before they ever pay.",
  },
  {
    title: "Built for creators",
    body: "Perfect if you write for, build for, or advise solo founders, indie hackers and app makers.",
  },
];

export default function AffiliatesPage() {
  return (
    <main aria-label="ReachKit affiliate program" style={{ background: "#fff" }}>
      <section style={{ position: "relative", overflow: "hidden", background: "radial-gradient(1100px 480px at 50% -8%, #F2EEFF 0%, rgba(242,238,255,0) 62%), #fff" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 28px 0" }}>
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6E56F7", margin: 0 }}>
            Affiliate program
          </p>
          <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "#14131A", margin: "16px 0 0", maxWidth: 740 }}>
            Get paid to help founders get found
          </h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "#56535F", margin: "18px 0 0", maxWidth: 580 }}>
            We&apos;re opening a referral program for creators and consultants in the indie-founder
            space. Recurring commission, honest product, no spammy gimmicks.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {POINTS.map((p) => (
            <div
              key={p.title}
              style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 16, padding: "24px 26px" }}
            >
              <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em", color: "#14131A", margin: 0 }}>
                {p.title}
              </h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.5, color: "#56535F", margin: "10px 0 0" }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, marginTop: 28, background: "#F2EEFF", border: "1px solid #ECEAF3", borderRadius: 18, padding: "24px 26px" }}
        >
          <p style={{ fontSize: 15.5, lineHeight: 1.5, color: "#14131A", margin: 0 }}>
            Want in early? Email us and we&apos;ll add you when the program opens.
          </p>
          <a
            href="mailto:hello@reachkit.app?subject=ReachKit%20affiliate%20program"
            style={{ display: "inline-block", background: "#6E56F7", color: "#fff", borderRadius: 10, padding: "11px 20px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
          >
            Join the waitlist
          </a>
        </div>
      </section>
    </main>
  );
}
