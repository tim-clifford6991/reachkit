/**
 * /teardowns — Teardowns index. Clean Claude Design layout (flat cards, Space
 * Grotesk, violet) over the real allTeardowns content. Keeps CollectionPage
 * JSON-LD.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, SITE } from "@/lib/seo";
import { allTeardowns } from "@/content/teardowns";

export const metadata: Metadata = buildMetadata({
  title: "App Teardowns — Discoverability Analyses",
  description:
    "Public discoverability analyses of real apps. Scores, keyword gaps, positioning findings, and ranked actions — so you can see exactly what ReachKit surfaces.",
  path: "/teardowns",
});

function collectionPageLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "App Discoverability Teardowns — ReachKit",
    description:
      "Public discoverability analyses of real iOS and web apps. Scores, keyword gaps, positioning findings, and ranked action plans.",
    url: `${SITE.url}/teardowns`,
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    hasPart: allTeardowns.map((t) => ({ "@type": "Article", headline: t.title, url: `${SITE.url}/teardowns/${t.slug}`, datePublished: t.publishedAt })),
  } as const;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

// Score → band color (mockup ramp: red → orange → gold → green).
function scoreColor(s: number): string {
  if (s < 35) return "#E5484D";
  if (s < 55) return "#E0731C";
  if (s < 70) return "#C98A12";
  return "#1F9D5B";
}

export default function TeardownsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageLd()) }} />
      <main aria-label="Teardowns" style={{ background: "#fff" }}>
        {/* Hero */}
        <section style={{ position: "relative", overflow: "hidden", background: "radial-gradient(1100px 480px at 50% -8%, #F2EEFF 0%, rgba(242,238,255,0) 62%), #fff" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "70px 28px 36px", textAlign: "center" }}>
            <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6E56F7", margin: 0 }}>Discoverability analyses</p>
            <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2.1rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "#14131A", margin: "16px auto 0", maxWidth: 800 }}>
              What a ReachKit scan actually finds
            </h1>
            <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "#56535F", margin: "18px auto 0", maxWidth: 600 }}>
              {allTeardowns.length} real apps. Scored, evidenced, and written out in full — so you can see the gap between what a listing says and what it earns in search before you run your own scan.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 24 }}>
              <Link href="/scan" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "#fff", background: "#6E56F7", borderRadius: 9, padding: "11px 20px", textDecoration: "none" }}>Scan your app free</Link>
              <Link href="/how-it-works" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "#14131A", background: "#fff", border: "1px solid #ECEAF3", borderRadius: 9, padding: "11px 20px", textDecoration: "none" }}>How it works</Link>
            </div>
          </div>
        </section>

        {/* Grid */}
        <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 28px 88px" }}>
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6E56F7", margin: "0 0 6px" }}>Real teardowns</p>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.6rem, 3vw, 2.2rem)", letterSpacing: "-0.02em", color: "#14131A", margin: "0 0 22px" }}>See what a real scan surfaces</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
            {allTeardowns.map((t) => (
              <Link key={t.slug} href={`/teardowns/${t.slug}`} style={{ display: "block", background: "#fff", border: "1px solid #ECEAF3", borderRadius: 16, padding: "22px 22px 20px", textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9A97A5" }}>{t.appName}</span>
                  <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 22, color: scoreColor(t.score.total), lineHeight: 1 }}>{t.score.total}<span style={{ fontSize: 11, color: "#9A97A5" }}>/100</span></span>
                </div>
                <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em", color: "#14131A", margin: "10px 0 8px" }}>{t.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: "#56535F", margin: 0 }}>{t.blurb}</p>
                <span style={{ display: "inline-block", marginTop: 14, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "#6E56F7" }}>Read the teardown →</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
