/**
 * /teardowns — Teardowns index. Clean Claude Design layout (flat cards, Space
 * Grotesk, violet) over the real allTeardowns content. Keeps CollectionPage
 * JSON-LD.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata, SITE } from "@/lib/seo";
import { allTeardowns } from "@/content/teardowns";
import { Suspense } from "react";
import { HeroFade } from "@/components/sections/hero-fade";
import { listPublicScans, countPublicScans } from "@/lib/scan/public-scans";
import { TeardownSearch } from "./teardown-search";

/** Live-scan page size — also imported by the sitemap (Task 3). */
export const TEARDOWNS_PAGE_SIZE = 24;

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

interface TeardownsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function TeardownsPage({ searchParams }: TeardownsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const parsedPage = parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : 1;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageLd()) }} />
      <main aria-label="Teardowns" style={{ background: "var(--c-surface)" }}>
        {/* Hero */}
        <HeroFade padding="70px 28px 36px">
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>Discoverability analyses</p>
          <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(2.1rem, 4.5vw, 3.4rem)", letterSpacing: "-0.02em", lineHeight: 1.04, color: "var(--c-ink)", margin: "16px auto 0", maxWidth: 800 }}>
            What a ReachKit scan actually finds
          </h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.5, color: "var(--c-muted)", margin: "18px auto 0", maxWidth: 600 }}>
            {allTeardowns.length} real apps. Scored, evidenced, and written out in full — so you can see the gap between what a listing says and what it earns in search before you run your own scan.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 24 }}>
            <Link href="/scan" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "#fff", background: "var(--c-action)", borderRadius: 9, padding: "11px 20px", textDecoration: "none" }}>Scan your app free</Link>
            <Link href="/how-it-works" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-ink)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 9, padding: "11px 20px", textDecoration: "none" }}>How it works</Link>
          </div>
        </HeroFade>

        {/* Grid */}
        <section style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 28px 88px" }}>
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: "0 0 6px" }}>Real teardowns</p>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.6rem, 3vw, 2.2rem)", letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "0 0 22px" }}>See what a real scan surfaces</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
            {allTeardowns.map((t) => (
              <Link key={t.slug} href={`/teardowns/${t.slug}`} style={{ display: "block", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "22px 22px 20px", textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>{t.appName}</span>
                  <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 22, color: scoreColor(t.score.total), lineHeight: 1 }}>{t.score.total}<span style={{ fontSize: 11, color: "var(--c-faint)" }}>/100</span></span>
                </div>
                <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: "10px 0 8px" }}>{t.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--c-muted)", margin: 0 }}>{t.blurb}</p>
                <span style={{ display: "inline-block", marginTop: 14, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-action)" }}>Read the teardown →</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Live scans — every free scan we run becomes a public teardown.
            We never hide a cost we incurred: each one is a permanent,
            free-redacted public report (and an indexable SEO surface). */}
        <section style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px 88px" }}>
          <p style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: "0 0 6px" }}>Live scans</p>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)", letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "0 0 8px" }}>
            Every scan we run is public
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)", margin: "0 0 18px", maxWidth: 640 }}>
            Each free scan becomes a permanent public report — the score, the positioning read, and the findings.
            Yours will too (that&rsquo;s the deal for a free scan of real market data).
          </p>
          <Suspense fallback={null}>
            <LiveScans q={q} page={page} />
          </Suspense>
        </section>
      </main>
    </>
  );
}

async function LiveScans({ q, page: pageIn }: { q?: string; page: number }) {
  const total = await countPublicScans({ q });
  const totalPages = Math.max(1, Math.ceil(total / TEARDOWNS_PAGE_SIZE));
  // Clamp an out-of-range ?page= (hand-edited / stale crawl) to the last page so
  // it never renders an empty grid under a "Page 999 of 3" pager.
  const page = Math.min(pageIn, totalPages);
  const scans = await listPublicScans({ q, limit: TEARDOWNS_PAGE_SIZE, offset: (page - 1) * TEARDOWNS_PAGE_SIZE });
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  const pageHref = (n: number) => `/teardowns?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${n}`;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <p style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-muted)", margin: 0 }}>
          {total} scan{total === 1 ? "" : "s"} indexed
        </p>
      </div>
      <div style={{ marginBottom: 18 }}>
        <TeardownSearch initialQ={q ?? ""} />
      </div>

      {total === 0 ? (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, color: "var(--c-muted)" }}>
          No teardowns match &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
            {scans.map((s) => (
              <Link
                key={s.slug}
                href={`/scan/${s.slug}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 12, padding: "12px 14px", textDecoration: "none" }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: SG, fontWeight: 700, fontSize: 13.5, color: "var(--c-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.host}</span>
                  <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)" }}>{fmt(s.completedAt)}</span>
                </span>
                {s.score !== null && (
                  <span style={{ flexShrink: 0, fontFamily: JM, fontWeight: 700, fontSize: 15, color: "var(--c-action)" }}>{s.score}</span>
                )}
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 24 }}>
              {page > 1 ? (
                <Link href={pageHref(page - 1)} style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13.5, color: "var(--c-action)", textDecoration: "none" }}>
                  ← Prev
                </Link>
              ) : (
                <span style={{ width: 1 }} />
              )}
              <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)" }}>
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13.5, color: "var(--c-action)", textDecoration: "none" }}>
                  Next →
                </Link>
              ) : (
                <span style={{ width: 1 }} />
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
