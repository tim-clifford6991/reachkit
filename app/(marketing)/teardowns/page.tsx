/**
 * /teardowns — the single public teardown index. Every completed scan becomes a
 * permanent, free-redacted public report at /scan/<slug>; this page lists them
 * all as teardown cards (logo + score + positioning-gap blurb) with an instant
 * client-side search. Keeps CollectionPage JSON-LD (built from the live scans).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buildMetadata, SITE } from "@/lib/seo";
import { HeroFade } from "@/components/sections/hero-fade";
import { listPublicScans, type PublicScan } from "@/lib/scan/public-scans";
import { TeardownGrid } from "./teardown-grid";

const SG = "var(--font-display)", JM = "var(--font-mono)";

export const metadata: Metadata = buildMetadata({
  title: "App Teardowns — Discoverability Analyses",
  description:
    "Public discoverability analyses of real apps. Scores, keyword gaps, positioning findings, and ranked actions — so you can see exactly what ReachKit surfaces.",
  path: "/teardowns",
});

function collectionPageLd(scans: PublicScan[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "App Discoverability Teardowns — ReachKit",
    description:
      "Public discoverability analyses of real web apps. Scores, keyword gaps, positioning findings, and ranked action plans.",
    url: `${SITE.url}/teardowns`,
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    hasPart: scans.map((s) => ({
      "@type": "Article",
      headline: `Web Teardown: ${s.host}`,
      url: `${SITE.url}/scan/${s.slug}`,
      ...(s.completedAt ? { datePublished: s.completedAt } : {}),
    })),
  } as const;
}

export default function TeardownsPage() {
  return (
    <main aria-label="Teardowns" style={{ background: "var(--c-surface)" }}>
      {/* Hero */}
      <HeroFade padding="70px 28px 36px">
        <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>Discoverability analyses</p>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2.1rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "var(--c-ink)", margin: "16px auto 0", maxWidth: 800 }}>
          Every scan is a public teardown
        </h1>
        <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: "18px auto 0", maxWidth: 600 }}>
          Every site we scan gets a permanent, public discoverability report — the score, the positioning gap, and the fixes that move it. Browse them, or run your own.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 24 }}>
          <Link href="/scan" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "#fff", background: "var(--c-action)", borderRadius: 9, padding: "11px 20px", textDecoration: "none" }}>Scan your site free</Link>
          <Link href="/how-it-works" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-ink)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 9, padding: "11px 20px", textDecoration: "none" }}>How it works</Link>
        </div>
      </HeroFade>

      {/* Single grid — every completed scan, searchable */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 28px 88px" }}>
        <Suspense fallback={null}>
          <LiveScansSection />
        </Suspense>
      </section>
    </main>
  );
}

// The DB read lives inside <Suspense> (cacheComponents: an uncached await outside
// a Suspense boundary throws "blocking-route"). We fetch the full set once and
// hand it to the client grid, which filters instantly as the user types.
async function LiveScansSection() {
  const scans = await listPublicScans({ limit: 500 });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageLd(scans)) }} />
      <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: "0 0 6px" }}>Real teardowns</p>
      <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.6rem, 3vw, 2.2rem)", letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "0 0 22px" }}>
        {scans.length} public teardown{scans.length === 1 ? "" : "s"}
      </h2>
      <TeardownGrid scans={scans} />
    </>
  );
}
