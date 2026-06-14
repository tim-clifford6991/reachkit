/**
 * Billing page — tier status, upgrade/manage controls (Task 21a, E4).
 *
 * Server: resolves tier + subscription status. Client actions: checkout +
 * portal via POST fetch → window.location redirect. Handles ?upgraded=1
 * (Stripe success toast) + ?billing=demo (fixture note).
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";
import { BillingActions } from "./billing-actions";
import type { Tier } from "@/lib/billing/tiers";

export const metadata = buildMetadata({ title: "Billing", path: "/app/billing" });

// ---------------------------------------------------------------------------
// Tier details
// ---------------------------------------------------------------------------

const TIER_DETAILS: Record<
  Tier,
  {
    label: string;
    price: string;
    description: string;
    features: string[];
  }
> = {
  free: {
    label: "Free",
    price: "$0",
    description: "One scan, 3 sample actions, no queue.",
    features: [
      "One discoverability scan",
      "3 sample action cards (blurred)",
      "Full four-question report",
    ],
  },
  solo: {
    label: "Solo",
    price: "$59/mo",
    description: "1 app, weekly queue, monitoring, score history.",
    features: [
      "1 app tracked",
      "Weekly action queue with draft copy",
      "Score history & deltas",
      "Action verification",
      "Rank depth: 20 keywords",
    ],
  },
  growth: {
    label: "Growth",
    price: "$129/mo",
    description: "3 apps, higher quotas, deeper rank tracking.",
    features: [
      "3 apps tracked",
      "Weekly action queue with draft copy",
      "100 draft actions per refresh",
      "Score history & deltas",
      "Action verification",
      "Rank depth: 50 keywords",
    ],
  },
};

// ---------------------------------------------------------------------------
// Server-fetched content
// ---------------------------------------------------------------------------

async function BillingContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/login?next=/app");

  const entitlements = await entitlementsFor(viewer.user.id);
  const tier: Tier = entitlements.active ? entitlements.tier : "free";
  const isActivePaid = entitlements.active;

  const tierDetails = TIER_DETAILS[tier];

  return (
    <div className="space-y-8">
      {/* Current plan card */}
      <section
        aria-labelledby="current-plan-heading"
        className="rounded-xl border"
        style={{
          borderColor:
            tier !== "free"
              ? "var(--color-accent-900)"
              : "var(--hairline)",
          background:
            tier !== "free"
              ? "oklch(0.70 0.13 66 / 0.05)"
              : "var(--color-surface)",
        }}
      >
        <div className="px-7 py-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p
                className="font-mono text-[10px] uppercase tracking-widest"
                style={{ color: "var(--color-muted)" }}
              >
                Current plan
              </p>
              <h2
                id="current-plan-heading"
                className="mt-0.5 text-xl font-semibold"
                style={{ color: "var(--color-fg)" }}
              >
                {tierDetails.label}
              </h2>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className="font-mono text-lg font-semibold tabular-nums"
                style={{ color: "var(--color-fg)" }}
              >
                {tierDetails.price}
              </span>
              {isActivePaid && (
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                  style={{
                    background: "var(--color-success-subtle)",
                    color: "var(--color-success)",
                    borderColor: "oklch(0.72 0.17 155 / 0.3)",
                  }}
                >
                  Active
                </span>
              )}
            </div>
          </div>

          <p
            className="mb-4 text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            {tierDetails.description}
          </p>

          <ul className="space-y-2">
            {tierDetails.features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2.5 text-sm"
                style={{ color: "var(--color-fg)" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden
                  className="mt-0.5 shrink-0"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="6"
                    stroke={
                      tier !== "free"
                        ? "var(--color-accent-500)"
                        : "var(--color-muted)"
                    }
                    strokeWidth="1.25"
                  />
                  <path
                    d="M4.5 7l1.75 1.75L9.5 5"
                    stroke={
                      tier !== "free"
                        ? "var(--color-accent-500)"
                        : "var(--color-muted)"
                    }
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Actions: manage or upgrade */}
      <BillingActions tier={tier} isActivePaid={isActivePaid} />

      {/* Tier comparison — only for non-growth */}
      {tier !== "growth" && (
        <TierComparisonTable currentTier={tier} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier comparison table
// ---------------------------------------------------------------------------

const COMPARISON_ROWS = [
  {
    feature: "Apps tracked",
    free: "1",
    solo: "1",
    growth: "3",
  },
  {
    feature: "Weekly action queue",
    free: "—",
    solo: "Yes",
    growth: "Yes",
  },
  {
    feature: "Draft copy",
    free: "—",
    solo: "Yes",
    growth: "Yes",
  },
  {
    feature: "Score history",
    free: "—",
    solo: "Yes",
    growth: "Yes",
  },
  {
    feature: "Action verification",
    free: "—",
    solo: "Yes",
    growth: "Yes",
  },
  {
    feature: "Draft quota / refresh",
    free: "—",
    solo: "20",
    growth: "100",
  },
  {
    feature: "Rank depth",
    free: "—",
    solo: "20 kws",
    growth: "50 kws",
  },
] as const;

function TierComparisonTable({ currentTier }: { currentTier: Tier }) {
  return (
    <section
      aria-labelledby="comparison-heading"
      className="rounded-xl border"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
      }}
    >
      <div className="px-7 py-6">
        <h3
          id="comparison-heading"
          className="mb-4 text-sm font-semibold"
          style={{ color: "var(--color-fg)" }}
        >
          Plan comparison
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Plan comparison">
            <thead>
              <tr>
                <th
                  className="pb-2 text-left font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--color-muted)" }}
                >
                  Feature
                </th>
                {(["free", "solo", "growth"] as const).map((t) => (
                  <th
                    key={t}
                    className="pb-2 text-right font-mono text-[10px] uppercase tracking-widest"
                    style={{
                      color:
                        t === currentTier
                          ? "var(--color-accent-400)"
                          : "var(--color-muted)",
                    }}
                  >
                    {t === "free"
                      ? "Free"
                      : t === "solo"
                      ? "Solo $59"
                      : "Growth $129"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  style={{
                    borderTop:
                      i === 0
                        ? undefined
                        : "1px solid var(--fill-subtle)",
                  }}
                >
                  <td
                    className="py-2 pr-4"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {row.feature}
                  </td>
                  {(["free", "solo", "growth"] as const).map((t) => (
                    <td
                      key={t}
                      className="py-2 text-right tabular-nums"
                      style={{
                        color:
                          row[t] === "—"
                            ? "var(--hairline-strong)"
                            : t === currentTier
                            ? "var(--color-fg)"
                            : "var(--color-muted)",
                        fontWeight: t === currentTier ? 500 : 400,
                      }}
                    >
                      {row[t]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function BillingSkeleton() {
  return (
    <div className="space-y-8">
      <div
        className="rounded-xl border p-7"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <Skeleton className="mb-3 h-3 w-20" />
        <Skeleton className="mb-4 h-6 w-24" />
        <Skeleton className="mb-2 h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div
        className="h-24 rounded-xl border"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8">
      <div>
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Account
        </p>
        <h1
          className="mt-0.5 text-xl font-semibold"
          style={{ color: "var(--color-fg)" }}
        >
          Billing
        </h1>
      </div>

      <Suspense fallback={<BillingSkeleton />}>
        <BillingContent />
      </Suspense>
    </div>
  );
}
