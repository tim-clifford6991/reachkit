import type { Metadata } from "next";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "Why ReachKit exists: a discoverability engine that gives solo founders a scored report and a weekly, verified action plan — without an agency.",
  path: "/about",
});

const SG = "var(--font-display)", JM = "var(--font-mono)";

export default function AboutPage() {
  return (
    <main aria-label="About ReachKit" style={{ background: "#fff" }}>
      <section style={{ position: "relative", overflow: "hidden", background: "radial-gradient(1100px 480px at 50% -8%, #F2EEFF 0%, rgba(242,238,255,0) 62%), #fff" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 28px 0" }}>
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6E56F7", margin: 0 }}>
            About
          </p>
          <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "#14131A", margin: "16px 0 0", maxWidth: 760 }}>
            Built for founders who ship, not agencies who bill
          </h1>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "#56535F", margin: 0 }}>
            Most products don&apos;t fail because they&apos;re bad. They fail because nobody can find
            them. The people who&apos;d love your app are searching — they just land on someone
            else&apos;s listing instead of yours.
          </p>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "#56535F", margin: 0 }}>
            ReachKit exists to close that gap. Paste a URL and you get a Discoverability Score, an
            honest read on who your page actually speaks to, the searches you&apos;re invisible for,
            and a ranked list of fixes — grounded in your live page, not generic advice. Then a weekly
            engine keeps you moving and verifies each change actually shipped.
          </p>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "#56535F", margin: 0 }}>
            It&apos;s made by{" "}
            <span style={{ color: "#14131A", fontWeight: 600 }}>Tim Clifford</span>, a solo
            founder who got tired of distribution being a black box you either ignore or pay an agency
            a fortune to manage. The goal is simple: make getting found a thing you can do yourself, a
            little every week.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 32 }}>
          <Link
            href="/scan"
            style={{ display: "inline-block", background: "#6E56F7", color: "#fff", borderRadius: 10, padding: "11px 20px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
          >
            Scan your product
          </Link>
          <Link
            href="/teardowns"
            style={{ display: "inline-block", background: "#fff", border: "1px solid #ECEAF3", color: "#14131A", borderRadius: 10, padding: "11px 20px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
          >
            Read a teardown
          </Link>
        </div>
      </section>
    </main>
  );
}
