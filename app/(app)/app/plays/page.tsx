/**
 * Plays page — §10.3 weekly action queue (Task 21a, E4).
 *
 * Server component that fetches the primary app's WeeklyPlan via
 * assembleWeeklyPlan (server-side, no API hop). Renders three buckets
 * (quickWins / medium / longPlay) with tick-off/verify controls via
 * a client component. Free users see an upgrade wall.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { assembleWeeklyPlan } from "@/lib/scan/weekly-plan";
import type { WeeklyPlanAction } from "@/lib/scan/weekly-plan";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";
import { PlaysBuckets } from "./plays-buckets";
import Link from "next/link";

export const metadata = buildMetadata({
  title: "This week's plays",
  path: "/app/plays",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekOf(weekOf: string): string {
  const d = new Date(`${weekOf}T00:00:00.000Z`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// Server-fetching content component
// ---------------------------------------------------------------------------

async function PlaysContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app");

  const { user } = viewer;
  const entitlements = await entitlementsFor(user.id);
  const isActivePaid = entitlements.active;
  const primaryAppId = user.app_ids[0] ?? null;

  // Free wall — the queue is a paid surface
  if (!isActivePaid) {
    return <PlaysUpgradeWall />;
  }

  if (!primaryAppId) {
    return <NoAppState />;
  }

  const plan = await assembleWeeklyPlan(primaryAppId);

  const allActions: WeeklyPlanAction[] = [
    ...plan.queue.quickWins,
    ...plan.queue.medium,
    ...plan.queue.longPlay,
  ];

  if (allActions.length === 0 && plan.carryover.length === 0) {
    return <EmptyQueueState weekOf={plan.weekOf} />;
  }

  return (
    <div className="space-y-6">
      {/* Week header */}
      <div
        className="flex items-start justify-between gap-4 rounded-xl border px-7 py-4"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <div>
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Week of
          </p>
          <p
            className="mt-0.5 text-base font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            {formatWeekOf(plan.weekOf)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-right">
          {plan.scoreDeltaLastWeek !== 0 && (
            <div>
              <p
                className="font-mono text-[10px] uppercase tracking-widest"
                style={{ color: "var(--color-muted)" }}
              >
                Score delta
              </p>
              <p
                className="font-mono text-base font-semibold tabular-nums"
                style={{
                  color:
                    plan.scoreDeltaLastWeek > 0
                      ? "var(--color-success)"
                      : "var(--color-danger)",
                }}
              >
                {plan.scoreDeltaLastWeek > 0 ? "+" : ""}
                {plan.scoreDeltaLastWeek}
              </p>
            </div>
          )}
          <div>
            <p
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-muted)" }}
            >
              Actions
            </p>
            <p
              className="font-mono text-base font-semibold tabular-nums"
              style={{ color: "var(--color-fg)" }}
            >
              {allActions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Anti-vanity honesty note */}
      {plan.honestyNote && (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: "var(--color-warning-subtle)",
            borderLeft: "3px solid var(--color-warning)",
          }}
        >
          <p
            className="mb-0.5 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-warning)" }}
          >
            Honest note
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-fg)" }}
          >
            {plan.honestyNote}
          </p>
        </div>
      )}

      {/* Carryover note */}
      {plan.carryover.length > 0 && (
        <p
          className="font-mono text-xs"
          style={{ color: "var(--color-muted)" }}
        >
          {plan.carryover.length} action
          {plan.carryover.length === 1 ? "" : "s"} carried over from last week
          — still open.
        </p>
      )}

      {/* Buckets — client for tick-off interaction */}
      <PlaysBuckets
        quickWins={plan.queue.quickWins}
        medium={plan.queue.medium}
        longPlay={plan.queue.longPlay}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upgrade wall — shown for free users
// ---------------------------------------------------------------------------

function PlaysUpgradeWall() {
  return (
    <div
      className="flex flex-col items-center rounded-xl border px-8 py-12 text-center"
      style={{
        borderColor: "var(--color-accent-900)",
        background: "oklch(0.70 0.13 66 / 0.05)",
      }}
    >
      {/* Icon */}
      <div
        className="mb-5 flex size-14 items-center justify-center rounded-full"
        style={{
          background: "var(--color-accent-subtle)",
          border: "1.5px solid var(--color-accent-900)",
        }}
        aria-hidden
      >
        <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
          <rect
            x="1.5"
            y="1.5"
            width="13"
            height="13"
            rx="2"
            stroke="var(--color-accent-400)"
            strokeWidth="1.5"
          />
          <path
            d="M5 5h6M5 8h4M5 11h5"
            stroke="var(--color-accent-400)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <p
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-accent-400)" }}
      >
        Paid feature
      </p>
      <h2
        className="mt-2 text-lg font-semibold"
        style={{ color: "var(--color-fg)" }}
      >
        Your weekly action queue
      </h2>
      <p
        className="mx-auto mt-3 max-w-sm text-sm leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        Get a prioritised queue of actions every week — with draft copy,
        effort estimates, and one-click verification that moves your score.
      </p>

      <div className="mt-6 flex flex-col items-center gap-2">
        <Link
          href="/app/billing"
          className="inline-flex items-center justify-center rounded-lg px-7 py-2 text-sm font-semibold transition-all"
          style={{
            background: "var(--color-accent-600)",
            color: "var(--color-accent-fg)",
          }}
        >
          Upgrade to Solo — $59/mo
        </Link>
        <p
          className="font-mono text-[10px]"
          style={{ color: "var(--color-muted)" }}
        >
          Cancel any time. No lock-in.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// No app state
// ---------------------------------------------------------------------------

function NoAppState() {
  return (
    <div
      className="rounded-xl border px-8 py-10 text-center"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
      }}
    >
      <p
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        No app yet
      </p>
      <p
        className="mt-2 text-sm"
        style={{ color: "var(--color-fg)" }}
      >
        Run a scan first to generate your action queue.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        style={{
          background: "var(--color-accent-600)",
          color: "var(--color-accent-fg)",
        }}
      >
        Run a scan
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty queue state
// ---------------------------------------------------------------------------

function EmptyQueueState({ weekOf }: { weekOf: string }) {
  return (
    <div
      className="rounded-xl border px-8 py-10 text-center"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
      }}
    >
      <p
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-success)" }}
      >
        All clear
      </p>
      <p
        className="mt-2 text-base font-semibold"
        style={{ color: "var(--color-fg)" }}
      >
        No open actions for {formatWeekOf(weekOf)}
      </p>
      <p
        className="mt-1.5 text-sm leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        Your queue refreshes weekly. Check back after the next scan.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PlaysSkeleton() {
  return (
    <div className="space-y-6">
      <div
        className="rounded-xl border p-7"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <Skeleton className="mb-2 h-3 w-20" />
        <Skeleton className="h-5 w-48" />
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border p-7"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--color-surface)",
          }}
        >
          <Skeleton className="mb-3 h-3 w-24" />
          <div className="space-y-3">
            {[1, 2].map((j) => (
              <div
                key={j}
                className="rounded-lg border px-4 py-3"
                style={{ borderColor: "var(--hairline)" }}
              >
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlaysPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
      <div>
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Action queue
        </p>
        <h1
          className="mt-0.5 text-xl font-semibold"
          style={{ color: "var(--color-fg)" }}
        >
          This week&apos;s plays
        </h1>
      </div>

      <Suspense fallback={<PlaysSkeleton />}>
        <PlaysContent />
      </Suspense>
    </div>
  );
}
