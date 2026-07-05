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
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { serverDb } from "@/lib/db/client";
import { resolveScanParam } from "@/lib/scan/scan-slug";
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
import { brandFromUrl } from "@/lib/brand/logo";
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
  const { slug: param } = await params;

  if (param === "_placeholder") {
    return buildMetadata({ title: "Discoverability Report", path: "/report/_placeholder" });
  }

  // Personal URL: the param is a domain (/report/nudgi.ai) or a legacy UUID.
  const resolved = await resolveScanParam(param);
  const slug = resolved?.slug ?? param;

  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload")
    .eq("id", resolved?.scanId ?? param)
    .maybeSingle();

  if (!data?.report_payload) {
    // Free scan: no full report, but the score + findings are public.
    const { data: free } = await db
      .from("scans")
      .select("score_total")
      .eq("id", resolved?.scanId ?? param)
      .maybeSingle();
    if (typeof free?.score_total === "number") {
      return buildMetadata({
        title: `Discoverability Score: ${free.score_total}/100 — ${slug}`,
        description: `Free discoverability teardown of ${slug}: the score, the positioning gap, and the findings. Run your own free scan on ReachKit.`,
        path: `/report/${slug}`,
      });
    }
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
  const { slug: param } = await params;

  // Build-time placeholder — render nothing
  if (param === "_placeholder") {
    return null;
  }

  // Next 16 cacheComponents: the uncached scan fetch must live inside <Suspense>.
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ResolvedReport param={param} />
    </Suspense>
  );
}

/** Resolve the domain-or-UUID param, 308 to the canonical personal URL, render. */
async function ResolvedReport({ param }: { param: string }) {
  const resolved = await resolveScanParam(param);
  if (!resolved) notFound();
  if (resolved.slug !== param) redirect(`/report/${resolved.slug}`);
  return <ReportContent slug={resolved.slug} scanId={resolved.scanId} />;
}

/**
 * Public report payload by slug. Cacheable (partial prerender): keyed only by the
 * immutable, completed scan id and fetched with the service-role client (no
 * cookies/request state), so it's safe to serve from cache. Tagged for targeted
 * revalidation (`report:<slug>`) if the scan is ever refreshed.
 */
async function getCachedReportPayload(
  scanId: string,
): Promise<{ payload: ReportPayload; storeUrl: string | null } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`report:${scanId}`);
  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload, apps(store_url)")
    .eq("id", scanId)
    .maybeSingle();
  const payload = data?.report_payload as unknown as ReportPayload | undefined;
  if (!payload) return null;
  const storeUrl = (data?.apps as unknown as { store_url?: string } | null)?.store_url ?? null;
  return { payload, storeUrl };
}

export async function ReportContent({ slug, scanId }: { slug: string; scanId: string }) {
  const cached = await getCachedReportPayload(scanId);

  if (!cached) {
    // Free scan — no full report, but every scan we run is public: the score,
    // the positioning mirror, and the findings are the (already-public) free
    // teaser. Never hide a cost we incurred.
    return <FreeScanTeardown scanId={scanId} slug={slug} />;
  }
  const { payload, storeUrl } = cached;
  const brand = brandFromUrl(storeUrl);
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
  // Pre-redaction keyword-gap total — the free redactor empties keywordGap, so
  // the public teaser counts from the full payload (never "Showing 0 of 0").
  const fullGapQueries = payload.market?.gap?.keywordGap?.length ?? 0;

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
        {...toResultsProps(report, brand?.host ?? "this site", fullActions, fullGapQueries)}
        logoUrl={brand?.logoUrl}
        siteHost={brand?.host}
        slug={slug}
        unlockTitle="Get your own Discoverability Score"
        unlockSub="Run a free scan of your site — the score, your positioning gap, and the 7 fixes that move it — in under a minute."
        unlockButton={
          <Link href="/scan" style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--c-ink)", background: "var(--c-surface)", borderRadius: 10, padding: "13px 24px", whiteSpace: "nowrap", textDecoration: "none" }}>
            Scan your site →
          </Link>
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

// ---------------------------------------------------------------------------
// Free-scan public teardown — the free-tier teaser (score + positioning +
// findings), server-rendered. This is the same information the anonymous
// funnel already shows, so it is public-safe by construction; the paid report
// never exists for these scans, so nothing paid can leak.
// ---------------------------------------------------------------------------

const T_SG = "var(--font-display)", T_JM = "var(--font-mono)";

async function getCachedFreeTeardown(scanId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`report:${scanId}`);
  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("score_total, findings_payload, completed_at, apps(store_url)")
    .eq("id", scanId)
    .maybeSingle();
  if (!data || typeof data.score_total !== "number") return null;
  const findings = data.findings_payload as unknown as {
    positioningMirror?: { listingSays: string; reviewsValue: string; gap: string };
    findings?: { category: string; claim: string; confidence: number }[];
  } | null;
  return {
    score: data.score_total,
    completedAt: data.completed_at as string | null,
    storeUrl: (data.apps as unknown as { store_url?: string } | null)?.store_url ?? null,
    mirror: findings?.positioningMirror ?? null,
    findings: findings?.findings ?? [],
  };
}

async function FreeScanTeardown({ scanId, slug }: { scanId: string; slug: string }) {
  const t = await getCachedFreeTeardown(scanId);
  if (!t) notFound();

  const ld = articleLd({
    headline: `Discoverability Score: ${t.score}/100 — ${slug}`,
    url: `${SITE.url}/report/${slug}`,
    datePublished: t.completedAt ?? new Date().toISOString(),
  });

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 90px" }}>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <p style={{ fontFamily: T_JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>Free scan teardown</p>
      <h1 style={{ fontFamily: T_SG, fontWeight: 700, fontSize: "clamp(1.8rem, 4vw, 2.6rem)", letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "10px 0 4px" }}>{slug}</h1>
      <p style={{ fontSize: 14, color: "var(--c-muted)", margin: "0 0 26px" }}>
        Scanned{t.completedAt ? ` ${new Date(t.completedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""} · every ReachKit scan is a public teardown
      </p>

      {/* Score */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "22px 26px", marginBottom: 14 }}>
        <span style={{ fontFamily: T_JM, fontWeight: 700, fontSize: 52, lineHeight: 1, color: "var(--c-action)" }}>{t.score}</span>
        <span style={{ fontFamily: T_JM, fontSize: 15, color: "var(--c-faint)" }}>/100 Discoverability Score</span>
      </div>

      {/* Positioning mirror */}
      {t.mirror && (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "20px 26px", marginBottom: 14 }}>
          <p style={{ fontFamily: T_JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)", margin: "0 0 10px" }}>Positioning mirror</p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--c-ink)", margin: "0 0 6px" }}><strong>The site says:</strong> {t.mirror.listingSays}</p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--c-ink)", margin: "0 0 6px" }}><strong>Users value:</strong> {t.mirror.reviewsValue}</p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--c-muted)", margin: 0 }}><strong>The gap:</strong> {t.mirror.gap}</p>
        </div>
      )}

      {/* Findings */}
      {t.findings.length > 0 && (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "20px 26px", marginBottom: 22 }}>
          <p style={{ fontFamily: T_JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)", margin: "0 0 12px" }}>What the scan found</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {t.findings.map((f, i) => (
              <li key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ flexShrink: 0, fontFamily: T_JM, fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--c-action)", background: "var(--c-soft)", padding: "2px 8px", borderRadius: 999 }}>{f.category.replace("_", "/")}</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--c-ink)" }}>{f.claim}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA */}
      <div style={{ background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 18, padding: "26px 28px", textAlign: "center" }}>
        <p style={{ fontFamily: T_SG, fontWeight: 700, fontSize: 18, color: "var(--c-on-dark, #fff)", margin: "0 0 6px" }}>Get your own Discoverability Score</p>
        <p style={{ fontSize: 13.5, color: "var(--c-on-dark-muted, #cfcbe0)", margin: "0 0 16px" }}>Free scan, under a minute, no account — and yes, it becomes a public teardown like this one.</p>
        <Link href="/scan" style={{ display: "inline-block", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 14, color: "var(--c-ink)", background: "#fff", borderRadius: 10, padding: "11px 22px", textDecoration: "none" }}>Scan your site →</Link>
      </div>
    </main>
  );
}
