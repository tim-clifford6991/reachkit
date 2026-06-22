/**
 * Q2 — Who it's for (full-bleed single-question view).
 *
 * Reuses WhoItsForSection from E2 components.
 * Data-fetching in Suspense per Next.js 16 cacheComponents requirement.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { entitlementsFor, redactReportForTier } from "@/lib/billing/entitlements";
import { isPaid } from "@/lib/billing/tiers";
import { serverDb } from "@/lib/db/client";
import type { ReportPayload } from "@/lib/scan/report";
import { WhoItsForSection } from "@/components/report/who-its-for-section";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Who it's for", path: "/app/audience" });

// ---------------------------------------------------------------------------
// Data-fetching component
// ---------------------------------------------------------------------------

async function AudienceContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app");

  const { user } = viewer;
  const primaryAppId = await activeAppId(user);
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
      <WhoItsForSection whoItsFor={report.whoItsFor} unlocked={userIsPaid} />

      {userIsPaid && report.whoItsFor.signals.length > 3 && (
        <section
          aria-labelledby="audience-signals-heading"
          className="rounded-xl border px-7 py-6"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--color-surface)",
          }}
        >
          <h2
            id="audience-signals-heading"
            className="mb-3 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            All buyer signals
          </h2>
          <div className="flex flex-wrap gap-2">
            {report.whoItsFor.signals.map((sig) => (
              <span
                key={sig}
                className="rounded-full border px-2.5 py-1 font-mono text-xs"
                style={{
                  borderColor: "var(--color-accent-900)",
                  background: "var(--color-accent-subtle)",
                  color: "var(--color-accent-400)",
                }}
              >
                {sig}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AudiencePage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
      <div>
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Question 2
        </p>
        <h1 className="mt-0.5 text-xl font-semibold" style={{ color: "var(--color-fg)" }}>
          Who it&apos;s for
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          Who is already buying this, and why?
        </p>
      </div>

      <Suspense fallback={<SectionSkeleton />}>
        <AudienceContent />
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
      <Skeleton className="mb-4 h-5 w-32" />
      <Skeleton className="mb-4 h-3 w-full" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}
