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
import { redactReportForTier } from "@/lib/billing/entitlements";
import { buildScoreCard } from "@/lib/badge/score-card";
import { WhatYouOfferSection } from "@/components/report/what-you-offer-section";
import { WhoItsForSection } from "@/components/report/who-its-for-section";
import { WhereTheyAreSection } from "@/components/report/where-they-are-section";
import { ActionPlanSection } from "@/components/report/action-plan-section";
import { SnapshotStrip } from "@/components/report/snapshot-strip";
import { ScoreBlock } from "./score-block";
import { BadgeEmbed } from "./badge-embed";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

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

export async function ReportContent({ slug }: { slug: string }) {
  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload")
    .eq("id", slug)
    .maybeSingle();

  if (!data?.report_payload) {
    notFound();
  }

  const payload = data.report_payload as unknown as ReportPayload;
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

  return (
    <>
      {/* Article JSON-LD */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-8">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="space-y-1">
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            ReachKit · Public report
          </p>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            Discoverability Report
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            Verified snapshot — scores reflect real surface data, not
            self-reported metrics.
          </p>
        </div>

        {/* §23 moment 6 — stale-report strip. Public report = never paid. */}
        <SnapshotStrip generatedAt={payload.generatedAt} isPaid={false} />

        {/* ── Score visual (client component, lazy-loads motion/react) ── */}
        <ScoreBlock score={payload.score} caption={card.caption} />

        {/* ── Four-question report sections — PUBLIC-SAFE TEASER ───────── */}
        {/* Redacted to "free" (drafts stripped, actions capped) + rendered    */}
        {/* unlocked={false}, identical to the free funnel view. The public    */}
        {/* report must never expose the paid deliverable.                     */}
        <WhatYouOfferSection
          whatYouOffer={report.whatYouOffer}
          unlocked={false}
        />
        <WhoItsForSection
          whoItsFor={report.whoItsFor}
          unlocked={false}
        />
        <WhereTheyAreSection
          whereTheyAre={report.whereTheyAre}
          unlocked={false}
        />
        <ActionPlanSection
          whatToDoThisWeek={report.whatToDoThisWeek}
          unlocked={false}
        />

        {/* ── §22 Growth loop: badge embed ─────────────────────────────── */}
        <BadgeEmbed slug={slug} total={card.total} />

        {/* Footer attribution */}
        <p
          className="text-center font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "oklch(1 0 0 / 0.2)" }}
        >
          Generated by{" "}
          <a
            href={SITE.url}
            className="transition-colors"
            style={{ color: "var(--color-accent-400)" }}
          >
            {SITE.name}
          </a>
          {" "}— discoverability analytics for solo founders
        </p>
      </main>
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
        style={{ borderColor: "oklch(1 0 0 / 0.09)", background: "var(--color-surface)" }}
      >
        <Skeleton className="size-[160px] rounded-full" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-5"
          style={{ borderColor: "oklch(1 0 0 / 0.09)", background: "var(--color-surface)" }}
        >
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </main>
  );
}
