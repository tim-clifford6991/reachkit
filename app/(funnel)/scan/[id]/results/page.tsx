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
// Page
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

  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload, completed_at, started_at")
    .eq("id", id)
    .maybeSingle();

  if (!data?.report_payload) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <div
          className="rounded-xl border p-6 text-center"
          style={{
            borderColor: "oklch(1 0 0 / 0.09)",
            background: "var(--color-surface)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Report not ready yet. Check back in a few seconds.
          </p>
        </div>
      </main>
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
  const generatedAt = data.completed_at ?? data.started_at ?? new Date().toISOString();

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 pt-8">
      {/* §23 moment 6 — stale-report strip. Honest, not nagging. */}
      <SnapshotStrip generatedAt={generatedAt} isPaid={isPaid} />

      {/* ── Score — signature visual; lazy-loaded client component ────── */}
      {/* ScoreBlock lazy-loads DiscoverabilityScore + motion so that        */}
      {/* motion/react doesn't inflate the initial server chunk.             */}
      <ScoreBlock score={report.score} />

      {/* §23 moment 7 — upgrade CTA at the E4 insertion point.             */}
      {/* Paywall framed as activation — queue, deltas, verification.        */}
      {!isPaid && <UpgradeCta scanId={id} />}

      {/* ── Four-question report sections — blur-to-sharp stagger ─────── */}
      {/* ReportReveal wraps each section in a motion div (blur-to-sharp). */}
      {/* Section components are server-rendered; reveal wrapper is client.  */}
      <ReportReveal>
        <WhatYouOfferSection
          whatYouOffer={report.whatYouOffer}
          unlocked={isPaid}
        />
        <WhoItsForSection
          whoItsFor={report.whoItsFor}
          unlocked={isPaid}
        />
        <WhereTheyAreSection
          whereTheyAre={report.whereTheyAre}
          unlocked={isPaid}
        />
        <ActionPlanSection
          whatToDoThisWeek={report.whatToDoThisWeek}
          unlocked={isPaid}
        />
      </ReportReveal>
    </main>
  );
}
