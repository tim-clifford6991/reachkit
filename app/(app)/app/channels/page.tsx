/**
 * Q3 — Where they are (full-bleed single-question view).
 *
 * Reuses WhereTheyAreSection from E2 components.
 * Data-fetching in Suspense per Next.js 16 cacheComponents requirement.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor, redactReportForTier } from "@/lib/billing/entitlements";
import { isPaid } from "@/lib/billing/tiers";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import { WhereTheyAreSection } from "@/components/report/where-they-are-section";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Where they are", path: "/app/channels" });

// ---------------------------------------------------------------------------
// Data-fetching component
// ---------------------------------------------------------------------------

async function ChannelsContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app");

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
      <WhereTheyAreSection whereTheyAre={report.whereTheyAre} unlocked={userIsPaid} />

      {!userIsPaid && (
        <div
          className="rounded-xl border px-7 py-6 text-center"
          style={{
            borderColor: "var(--color-accent-900)",
            background: "oklch(0.70 0.13 66 / 0.07)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
            See all communities and competitor analysis
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            Upgrade to unlock the full surface list and competitor gap breakdown.
          </p>
          <a
            href="/app/billing"
            className="mt-3 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: "var(--color-accent-600)",
              color: "var(--color-accent-fg)",
            }}
          >
            Upgrade to Solo
          </a>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
      <div>
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Question 3
        </p>
        <h1 className="mt-0.5 text-xl font-semibold" style={{ color: "var(--color-fg)" }}>
          Where they are
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Where do your potential buyers gather, and where are competitors outranking you?
        </p>
      </div>

      <Suspense fallback={<SectionSkeleton />}>
        <ChannelsContent />
      </Suspense>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div
      className="rounded-xl border p-7"
      style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
    >
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="mb-4 h-5 w-36" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-5 w-16 shrink-0 rounded" />
            <Skeleton className="h-5 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
