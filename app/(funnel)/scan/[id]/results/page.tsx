import { Suspense } from "react";
import { buildMetadata } from "@/lib/seo";
import { serverDb } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/server";
import { type Tier } from "@/lib/billing/tiers";
import { entitlementsFor, redactReportForTier } from "@/lib/billing/entitlements";
import type { ReportPayload } from "@/lib/scan/report";
import { WhatYouOfferSection } from "@/components/report/what-you-offer-section";
import { WhoItsForSection } from "@/components/report/who-its-for-section";
import { WhereTheyAreSection } from "@/components/report/where-they-are-section";
import { ActionPlanSection } from "@/components/report/action-plan-section";
import { SnapshotStrip } from "@/components/report/snapshot-strip";
import { UpgradeCta } from "@/components/report/upgrade-cta";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBlock } from "./score-block";
import { ReportReveal } from "./report-reveal";

export function generateStaticParams() {
  return [{ id: "_placeholder" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return buildMetadata({
    title: `Discoverability Report`,
    path: `/scan/${id}/results`,
  });
}

// ---------------------------------------------------------------------------
// Page — static shell; the uncached data fetch lives in a Suspense child
// (Next 16 cacheComponents: blocking data must be inside <Suspense>).
// ---------------------------------------------------------------------------

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "_placeholder") {
    return null;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-8">
      <Suspense fallback={<ResultsSkeleton />}>
        <ResultsContent id={id} />
      </Suspense>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Async content — all data fetching happens here, inside Suspense
// ---------------------------------------------------------------------------

async function ResultsContent({ id }: { id: string }) {
  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload, completed_at, started_at")
    .eq("id", id)
    .maybeSingle();

  if (!data?.report_payload) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Report not ready yet. Check back in a few seconds.
        </p>
      </div>
    );
  }

  const fullReport = data.report_payload as unknown as ReportPayload;

  // Resolve the viewer's EFFECTIVE tier and blur-lock the report accordingly.
  // Drafts unlock only for an ACTIVE subscription.
  const viewer = await currentUser();
  let tier: Tier = "free";
  if (viewer) {
    const ent = await entitlementsFor(viewer.user.id);
    tier = ent.active ? ent.tier : "free";
  }
  const report = redactReportForTier(fullReport, tier);
  const isPaid = tier !== "free";

  // Snapshot timestamp — prefer completed_at, fall back to started_at
  const generatedAt = data.completed_at ?? data.started_at ?? report.generatedAt;

  return (
    <>
      {/* §23 moment 6 — stale-report strip. Honest, not nagging. */}
      <SnapshotStrip generatedAt={generatedAt} isPaid={isPaid} />

      {/* ── Score — signature visual; lazy-loaded client component ────── */}
      <ScoreBlock score={report.score} />

      {/* §23 moment 7 — upgrade CTA at the E4 insertion point. */}
      {!isPaid && <UpgradeCta scanId={id} />}

      {/* ── Four-question report sections — blur-to-sharp stagger ─────── */}
      <ReportReveal>
        <WhatYouOfferSection whatYouOffer={report.whatYouOffer} unlocked={isPaid} />
        <WhoItsForSection whoItsFor={report.whoItsFor} unlocked={isPaid} />
        <WhereTheyAreSection whereTheyAre={report.whereTheyAre} unlocked={isPaid} />
        <ActionPlanSection whatToDoThisWeek={report.whatToDoThisWeek} unlocked={isPaid} />
      </ReportReveal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton (shown while the report fetch resolves)
// ---------------------------------------------------------------------------

function ResultsSkeleton() {
  return (
    <>
      <div
        className="flex flex-col items-center rounded-xl border py-10"
        style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
      >
        <Skeleton className="mb-6 h-3 w-28" />
        <Skeleton className="size-[160px] rounded-full" />
        <Skeleton className="mt-6 h-3 w-48" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-7"
          style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
        >
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="mb-2 h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-3/4" />
        </div>
      ))}
    </>
  );
}
