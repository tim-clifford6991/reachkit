/**
 * PublicReport — the public lead-magnet result renderer for /scan/[id].
 *
 * ALWAYS free-redacted. This is the shared growth-loop artifact reachable by
 * anyone with the scan slug/UUID — it must NEVER branch on viewer entitlement
 * (paid users see the full report in the authenticated /app, not here). No
 * `currentUser`/`entitlementsFor` import on purpose: that's the binding
 * constraint that keeps this route from ever leaking the paid deliverable.
 *
 * Ported from `app/report/[slug]/page.tsx`'s `ReportContent` (the existing
 * public teardown), keeping the same JSON-LD + ResultsScreen + BadgeEmbed
 * shape but under the new `/scan/[id]` public route.
 */

import type { JSX } from "react";
import { redactReportForTier } from "@/lib/billing/entitlements";
import { buildScoreCard } from "@/lib/badge/score-card";
import { ResultsScreen } from "@/components/report/captured/results-screen";
import { toResultsProps } from "@/components/report/captured/to-results-props";
import type { ResultsScreenProps } from "@/components/report/captured/results-screen";
import { CapturedUnlockButton } from "@/components/report/captured/unlock-button";
import { brandFromUrl } from "@/lib/brand/logo";
import { articleLd, SITE } from "@/lib/seo";
import type { ReportPayload } from "@/lib/scan/report";

// ---------------------------------------------------------------------------
// Pure wiring — extracted so the redaction + props mapping is unit-testable
// without rendering a server component.
// ---------------------------------------------------------------------------

export function publicReportProps(
  payload: ReportPayload,
  slug: string,
  storeUrl: string,
): {
  report: ReportPayload;
  resultsProps: ResultsScreenProps;
  badgeTotal: number;
  jsonLd: ReturnType<typeof articleLd>;
} {
  // PUBLIC-SAFE: always redact to "free" — no viewer/entitlement lookup, ever.
  // This route is reachable by anyone with the scan id, so it must never
  // expose the paid deliverable.
  const report = redactReportForTier(payload, "free");
  const brand = brandFromUrl(storeUrl);
  const card = buildScoreCard(report);

  // "Show the total, render a fraction": locked counts are read from the
  // FULL (pre-redaction) payload so the teaser names what it withholds.
  const fullActions =
    payload.whatToDoThisWeek.quickWins.length +
    payload.whatToDoThisWeek.medium.length +
    payload.whatToDoThisWeek.longPlay.length;
  // The teaser count must be the SAME collection the opportunity section renders
  // (paid rival gap when present, else the free category opportunities) — the old
  // categoryGap source is empty by construction for 0-ranking sites, which
  // rendered "Unlock all 0 category opportunities" live (scan 4093f1c9, WS-B).
  const fullGapQueries =
    (payload.market?.gap?.keywordGap?.length ?? 0) ||
    (payload.searchVisibility?.categoryOpportunities?.length ?? 0) ||
    (payload.searchVisibility?.categoryGap?.length ?? 0);

  const resultsProps: ResultsScreenProps = {
    ...toResultsProps(report, brand?.host ?? "your site", fullActions, fullGapQueries),
    logoUrl: brand?.logoUrl,
    siteHost: brand?.host,
    slug,
  };

  const jsonLd = articleLd({
    headline: `Discoverability Score: ${card.total}/100`,
    url: `${SITE.url}/scan/${slug}`,
    datePublished: payload.generatedAt,
  });

  return { report, resultsProps, badgeTotal: card.total, jsonLd };
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

export function PublicReport({
  scanId,
  slug,
  storeUrl,
  payload,
}: {
  scanId: string;
  slug: string;
  storeUrl: string;
  payload: ReportPayload;
}): JSX.Element {
  const { resultsProps, jsonLd } = publicReportProps(payload, slug, storeUrl);
  resultsProps.scanId = scanId;

  return (
    <>
      {/* Article JSON-LD (injected via script tag — generateMetadata cannot emit ld+json) */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Captured "results" screen 1:1, wired to the free-redacted payload.
          No hideUnlock: the locked band + upgrade CTA always show — the paid
          report lives in the authenticated app, never here. */}
      <ResultsScreen {...resultsProps} unlockButton={<CapturedUnlockButton scanId={scanId} />} />

      {/* Close on conversion: a pricing CTA (replaces the low-intent "copy your
          badge" snippet — a share embed doesn't move a founder to pay). */}
      <div className="mx-auto max-w-2xl px-4 pb-16">
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 18, padding: "26px 28px", textAlign: "center" }}>
          <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 20, color: "var(--c-ink)", marginBottom: 6 }}>Close the gap before your rivals widen it</div>
          <p style={{ fontSize: 14.5, color: "var(--c-muted)", margin: "0 auto 18px", maxWidth: 440, lineHeight: 1.55 }}>
            The full scan shows the exact category searches you&apos;re missing, which rivals win them, and a week-by-week plan to take them — with your score tracked as you ship.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <CapturedUnlockButton scanId={scanId} />
            <a href="/pricing" style={{ fontFamily: "Plus Jakarta Sans", fontWeight: 600, fontSize: 14.5, color: "var(--c-action)", background: "var(--c-surface)", border: "1.5px solid var(--c-tint-violet-line)", borderRadius: 10, padding: "12px 22px", textDecoration: "none" }}>See plans &amp; pricing →</a>
          </div>
        </div>
      </div>
    </>
  );
}
