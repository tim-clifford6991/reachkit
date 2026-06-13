/**
 * Q1 — What you offer (full-bleed single-question view).
 *
 * Reuses WhatYouOfferSection from E2 components.
 * Data-fetching in Suspense per Next.js 16 cacheComponents requirement.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor, redactReportForTier } from "@/lib/billing/entitlements";
import { isPaid } from "@/lib/billing/tiers";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import { WhatYouOfferSection } from "@/components/report/what-you-offer-section";
import { EvidencePanel } from "@/components/report/evidence-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "What you offer", path: "/app/offer" });

// ---------------------------------------------------------------------------
// Data-fetching component
// ---------------------------------------------------------------------------

async function OfferContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/");

  const { user } = viewer;
  const primaryAppId = user.app_ids[0] ?? null;
  if (!primaryAppId) redirect("/app");

  const db = serverDb();
  const entitlements = await entitlementsFor(user.id);
  const tier = entitlements.active ? entitlements.tier : "free";
  const userIsPaid = isPaid(tier);

  const { data: scanRow } = await db
    .from("scans")
    .select("report_payload")
    .eq("app_id", primaryAppId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!scanRow?.report_payload) redirect("/app");

  const fullReport = scanRow.report_payload as unknown as ReportPayload;
  const report = redactReportForTier(fullReport, tier);

  return (
    <div className="space-y-6">
      <WhatYouOfferSection whatYouOffer={report.whatYouOffer} unlocked={userIsPaid} />

      {userIsPaid && (
        <section
          aria-labelledby="offer-evidence-heading"
          className="rounded-xl border px-5 py-5"
          style={{
            borderColor: "oklch(1 0 0 / 0.09)",
            background: "var(--color-surface)",
          }}
        >
          <h2
            id="offer-evidence-heading"
            className="mb-3 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Evidence
          </h2>
          <EvidencePanel
            items={[
              ...report.whatToDoThisWeek.quickWins,
              ...report.whatToDoThisWeek.medium,
            ]
              .flatMap((a) => a.evidence)
              .slice(0, 6)}
          />
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OfferPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
      <div>
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Question 1
        </p>
        <h1 className="mt-0.5 text-xl font-semibold" style={{ color: "var(--color-fg)" }}>
          What you offer
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          What do you actually offer, in the language your market uses?
        </p>
      </div>

      <Suspense fallback={<SectionSkeleton />}>
        <OfferContent />
      </Suspense>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "oklch(1 0 0 / 0.09)", background: "var(--color-surface)" }}
    >
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="mb-4 h-5 w-36" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}
