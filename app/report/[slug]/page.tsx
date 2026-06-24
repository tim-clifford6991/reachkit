/**
 * Public shareable report — /report/[slug]
 *
 * §22 / §23 "moment 5" growth loop:
 *   - Fully public, no auth required
 *   - Slug = scan id (same convention as the funnel results page)
 *   - PUBLIC-SAFE TEASER: the payload is redacted to the "free" tier
 *     (`redactReportForTier(payload, "free")`) so the paid action DRAFTS are
 *     stripped server-side and the action set is capped — this is a shared
 *     growth-loop artifact reachable by anyone with the scan UUID, so it must
 *     NEVER expose the paid deliverable (else it's a paywall bypass + leak).
 *     Sections render with unlocked={false}, exactly like the free funnel view.
 *   - OG image points to /report/[slug]/opengraph-image (the score card)
 *   - Article JSON-LD for indexability
 *   - Badge embed (§22 growth loop) at the bottom — copy-paste snippet
 *
 * Missing / invalid slug → notFound() → Next.js clean 404.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverDb } from "@/lib/db/client";
import { buildMetadata, articleLd, SITE } from "@/lib/seo";
import type { ReportPayload } from "@/lib/scan/report";
import { buildExecutiveSummary } from "@/lib/scan/report";
import { redactReportForTier } from "@/lib/billing/entitlements";
import { buildScoreCard } from "@/lib/badge/score-card";
import { ExecutiveSummary } from "@/components/report/executive-summary";
import { WhatYouOfferSection } from "@/components/report/what-you-offer-section";
import { WhoItsForSection } from "@/components/report/who-its-for-section";
import { WhereTheyAreSection } from "@/components/report/where-they-are-section";
import { ActionPlanSection } from "@/components/report/action-plan-section";
import { SnapshotStrip } from "@/components/report/snapshot-strip";
import { ScoreBlock } from "./score-block";
import { BadgeEmbed } from "./badge-embed";
import { ResultsScreen } from "@/components/report/captured/results-screen";
import { toResultsProps } from "@/components/report/captured/to-results-props";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return [{ slug: "_placeholder" }];
}

// ---------------------------------------------------------------------------
// Metadata + JSON-LD
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (slug === "_placeholder") {
    return buildMetadata({ title: "Discoverability Report", path: "/report/_placeholder" });
  }

  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload")
    .eq("id", slug)
    .maybeSingle();

  if (!data?.report_payload) {
    return buildMetadata({ title: "Report not found", path: `/report/${slug}` });
  }

  const payload = data.report_payload as unknown as ReportPayload;
  const card = buildScoreCard(payload);
  const ogImageUrl = `${SITE.url}/report/${slug}/opengraph-image`;

  const base = buildMetadata({
    title: `Discoverability Score: ${card.total}/100`,
    description: card.caption,
    path: `/report/${slug}`,
  });

  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `ReachKit Discoverability Score ${card.total}/100 — verified, not vanity`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Discoverability Score: ${card.total}/100 — ${SITE.name}`,
      description: card.caption,
      images: [ogImageUrl],
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Build-time placeholder — render nothing
  if (slug === "_placeholder") {
    return null;
  }

  // Next 16 cacheComponents: the uncached scan fetch must live inside <Suspense>.
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportContent slug={slug} />
    </Suspense>
  );
}

/**
 * Public report payload by slug. Cacheable (partial prerender): keyed only by the
 * immutable, completed scan id and fetched with the service-role client (no
 * cookies/request state), so it's safe to serve from cache. Tagged for targeted
 * revalidation (`report:<slug>`) if the scan is ever refreshed.
 */
async function getCachedReportPayload(slug: string): Promise<ReportPayload | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`report:${slug}`);
  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload")
    .eq("id", slug)
    .maybeSingle();
  return (data?.report_payload as unknown as ReportPayload | undefined) ?? null;
}

export async function ReportContent({ slug }: { slug: string }) {
  const payload = await getCachedReportPayload(slug);

  if (!payload) {
    notFound();
  }
  const card = buildScoreCard(payload);
  const reportUrl = `${SITE.url}/report/${slug}`;

  // PUBLIC-SAFE: strip paid drafts + cap the action preview server-side. The
  // score/positioning/findings/surfaces stay (the teaser that drives others to
  // scan); the paid action plan does NOT leak. Same redactor the funnel uses.
  const report = redactReportForTier(payload, "free");

  // Article JSON-LD (injected via script tag — generateMetadata cannot emit ld+json)
  const ld = articleLd({
    headline: `Discoverability Score: ${card.total}/100`,
    url: reportUrl,
    datePublished: payload.generatedAt,
  });

  const fullActions =
    payload.whatToDoThisWeek.quickWins.length +
    payload.whatToDoThisWeek.medium.length +
    payload.whatToDoThisWeek.longPlay.length;

  return (
    <>
      {/* Article JSON-LD */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      {/* Captured "results" screen 1:1, wired to the free-redacted payload.
          Public-safe: same redactor as the funnel — paid drafts never leak. */}
      <ResultsScreen
        {...toResultsProps(report, "this site", fullActions)}
        slug={slug}
        unlockTitle="Get your own Discoverability Score"
        unlockSub="Run a free scan of your site — the score, your positioning gap, and the 7 fixes that move it, in ~90 seconds."
        unlockButton={
          <a href="/scan" style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 15, color: "#14131A", background: "#fff", borderRadius: 10, padding: "13px 24px", whiteSpace: "nowrap", textDecoration: "none" }}>
            Scan your site →
          </a>
        }
      />

      {/* §22 Growth loop: badge embed (kept below the captured screen). */}
      <div className="mx-auto max-w-2xl px-4 pb-16">
        <BadgeEmbed slug={slug} total={card.total} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton (shown while the public report fetch resolves)
// ---------------------------------------------------------------------------

function ReportSkeleton() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-8">
      <div className="space-y-1">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-56" />
      </div>
      <div
        className="flex flex-col items-center rounded-xl border py-10"
        style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
      >
        <Skeleton className="size-[160px] rounded-full" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-5"
          style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
        >
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </main>
  );
}
