/**
 * /teardowns — Teardowns index page (§22.2 GEO launch content)
 *
 * Hero + TeardownGrid of all 5 launch analyses.
 * SSR: fully server-rendered, no client wrappers.
 * JSON-LD: CollectionPage for the index.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { TeardownGrid } from "@/components/sections/teardown-grid";
import { buildMetadata, SITE } from "@/lib/seo";
import { allTeardowns } from "@/content/teardowns";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = buildMetadata({
  title: "App Teardowns — Discoverability Analyses",
  description:
    "Public discoverability analyses of real apps. Scores, keyword gaps, positioning findings, and ranked actions — so you can see exactly what ReachKit surfaces.",
  path: "/teardowns",
});

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

function collectionPageLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "App Discoverability Teardowns — ReachKit",
    description:
      "Public discoverability analyses of real iOS and web apps. Scores, keyword gaps, positioning findings, and ranked action plans.",
    url: `${SITE.url}/teardowns`,
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
    hasPart: allTeardowns.map((t) => ({
      "@type": "Article",
      headline: t.title,
      url: `${SITE.url}/teardowns/${t.slug}`,
      datePublished: t.publishedAt,
    })),
  } as const;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeardownsPage() {
  const gridContent = {
    eyebrow: "Real teardowns",
    headline: "See what a real scan surfaces",
    cards: allTeardowns.map((t) => ({
      title: t.title,
      app: t.appName,
      score: t.score.total,
      blurb: t.blurb,
      href: `/teardowns/${t.slug}`,
    })),
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageLd()) }}
      />

      <main>
        {/* Hero */}
        <section
          className="flex flex-col items-center gap-6 px-[--spacing-content-x] pb-0 pt-16 text-center sm:pt-24"
          aria-label="Teardowns introduction"
        >
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-accent-400)" }}
          >
            Discoverability analyses
          </p>

          <h1
            className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
            style={{ color: "var(--color-fg)", lineHeight: 1.1 }}
          >
            What a ReachKit scan actually finds
          </h1>

          <p
            className="max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--color-muted)" }}
          >
            Five real apps. Scored, evidenced, and written out in full — so you
            can see the gap between what a listing says and what it earns in
            search before you run your own scan.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/scan"
              className="inline-flex items-center rounded-lg px-5 py-2.5 font-mono text-sm font-semibold transition-all duration-150"
              style={{
                background: "var(--color-accent-400)",
                color: "var(--color-bg)",
              }}
            >
              Scan your app free
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-lg border px-5 py-2.5 font-mono text-sm transition-all duration-150"
              style={{
                borderColor: "oklch(1 0 0 / 0.12)",
                color: "var(--color-muted)",
              }}
            >
              How it works
            </Link>
          </div>
        </section>

        {/* Teardown grid */}
        <TeardownGrid content={gridContent} />

        {/* Footer context */}
        <section
          className="flex flex-col items-center gap-4 px-[--spacing-content-x] pb-20 text-center"
          aria-label="Teardown methodology note"
        >
          <div
            className="max-w-lg rounded-xl border p-6"
            style={{
              borderColor: "oklch(1 0 0 / 0.08)",
              background: "var(--color-surface)",
            }}
          >
            <p
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-accent-400)" }}
            >
              Methodology
            </p>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "var(--color-muted)" }}
            >
              Each teardown uses the same pipeline that runs for paying
              customers: App Store metadata, keyword density, review themes,
              competitor gap analysis, and community surface mapping. Scores
              reflect the state of the listing at the time of analysis and are
              periodically re-verified.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
