/**
 * Signal feed — the weekly digest timeline (ChannelIntel UX).
 *
 * Replaces the v1.5 "coming soon" stub: reads every weekly `refresh` scan_event
 * for the user's primary app (via listRefreshDigests) and renders each week as a
 * WhatsChanged card — competitor launches, share-of-voice shifts, keyword
 * openings, and the per-monitor change summaries. Paid retention surface; the
 * weekly refresh only runs for active paid apps, so free users see the empty
 * state until they upgrade.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { listRefreshDigests } from "@/lib/scan/digest";
import { WhatsChanged } from "@/components/app/whats-changed";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Signal feed", path: "/app/feed" });

async function FeedContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app/feed");

  const primaryAppId = await activeAppId(viewer.user);
  const digests = primaryAppId ? await listRefreshDigests(primaryAppId) : [];

  // Quiet/no-op weeks have nothing to show — keep only weeks with signal.
  const withSignal = digests.filter((d) => d.alerts.length > 0 || d.changes.length > 0);

  if (withSignal.length === 0) {
    return <FeedEmptyState />;
  }

  return (
    <div className="space-y-4">
      {withSignal.map((d) => (
        <WhatsChanged key={d.createdAt} digest={d} />
      ))}
    </div>
  );
}

function FeedEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div
        className="max-w-sm rounded-xl border px-8 py-10 text-center"
        style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
      >
        <div
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full"
          style={{ background: "oklch(0.70 0.13 66 / 0.12)", border: "1.5px solid var(--color-accent-900)" }}
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M2 13a9 9 0 019-9" stroke="var(--color-accent-400)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M2 9a5 5 0 015-5" stroke="var(--color-accent-400)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="3" cy="13" r="1" fill="var(--color-accent-400)" />
          </svg>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
          No signals yet
        </p>
        <h1 className="mt-2 text-base font-semibold" style={{ color: "var(--color-fg)" }}>
          Your weekly signal feed
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
          Every week we re-scan your market and log what moved — new competitors,
          share-of-voice shifts, keyword openings, fresh reviews. Your first
          weekly digest appears here after the next refresh.
        </p>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-6"
          style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
        >
          <Skeleton className="mb-3 h-3 w-40" />
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function FeedPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--color-fg)" }}>
          What moved, week by week
        </h1>
      </div>
      <Suspense fallback={<FeedSkeleton />}>
        <FeedContent />
      </Suspense>
    </div>
  );
}
