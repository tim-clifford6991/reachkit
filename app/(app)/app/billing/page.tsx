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
import { BillingSkeleton } from "@/components/app/captured/skeletons";
import { buildMetadata } from "@/lib/seo";
import { BillingActions } from "./billing-actions";
import type { Tier } from "@/lib/billing/tiers";

export const metadata = buildMetadata({ title: "Billing", path: "/app/billing" });

// ---------------------------------------------------------------------------
// Design tokens — Claude Design mockup spec (literal hex, matching captured app)
// ---------------------------------------------------------------------------

const SG = "Space Grotesk", JM = "JetBrains Mono", PJ = "Plus Jakarta Sans";
const INK = "var(--c-ink)", BODY = "var(--c-muted)", FAINT = "var(--c-faint)", VIOLET = "var(--c-action)";
const CARD_BORDER = "var(--c-line)";

const cardStyle: React.CSSProperties = {
  background: "var(--c-surface)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 16,
  padding: "22px 24px",
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: JM,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: FAINT,
};

const headingStyle: React.CSSProperties = {
  fontFamily: SG,
  fontWeight: 700,
  fontSize: 19,
  letterSpacing: "-0.01em",
  color: INK,
};

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

  const isPaid = tier !== "free";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Current plan card */}
      <section
        aria-labelledby="current-plan-heading"
        style={{
          ...cardStyle,
          ...(isPaid
            ? { border: `1.5px solid ${VIOLET}` }
            : {}),
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <div>
            <p style={eyebrowStyle}>Current plan</p>
            <h2
              id="current-plan-heading"
              style={{ ...headingStyle, marginTop: 4 }}
            >
              {tierDetails.label}
            </h2>
          </div>

          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 18, color: INK }}>
              {tierDetails.price}
            </span>
            {isActivePaid && (
              <span
                style={{
                  background: "var(--c-tint-green)",
                  color: "#1F9D5B",
                  fontFamily: JM,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "3px 10px",
                  borderRadius: 7,
                }}
              >
                Active
              </span>
            )}
          </div>
        </div>

        <p style={{ fontSize: 14, color: BODY, marginBottom: 16 }}>
          {tierDetails.description}
        </p>

        <ul style={{ display: "flex", flexDirection: "column", gap: 9, listStyle: "none", margin: 0, padding: 0 }}>
          {tierDetails.features.map((f) => (
            <li
              key={f}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: INK }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
                style={{ marginTop: 3, flexShrink: 0 }}
              >
                <circle
                  cx="7"
                  cy="7"
                  r="6"
                  stroke={isPaid ? VIOLET : FAINT}
                  strokeWidth="1.25"
                />
                <path
                  d="M4.5 7l1.75 1.75L9.5 5"
                  stroke={isPaid ? VIOLET : FAINT}
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {f}
            </li>
          ))}
        </ul>
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
    <section aria-labelledby="comparison-heading" style={cardStyle}>
      <h3
        id="comparison-heading"
        style={{ ...headingStyle, fontSize: 18, marginBottom: 16 }}
      >
        Plan comparison
      </h3>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }} aria-label="Plan comparison">
          <thead>
            <tr>
              <th style={{ ...eyebrowStyle, textAlign: "left", paddingBottom: 10 }}>
                Feature
              </th>
              {(["free", "solo", "growth"] as const).map((t) => (
                <th
                  key={t}
                  style={{
                    ...eyebrowStyle,
                    textAlign: "right",
                    paddingBottom: 10,
                    color: t === currentTier ? VIOLET : FAINT,
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
                  borderTop: i === 0 ? undefined : "1px solid var(--c-fill)",
                }}
              >
                <td style={{ padding: "9px 16px 9px 0", color: BODY }}>
                  {row.feature}
                </td>
                {(["free", "solo", "growth"] as const).map((t) => (
                  <td
                    key={t}
                    style={{
                      padding: "9px 0",
                      textAlign: "right",
                      fontFamily: JM,
                      fontSize: 13,
                      fontWeight: t === currentTier ? 700 : 400,
                      color:
                        row[t] === "—"
                          ? "#CBC8D6"
                          : t === currentTier
                          ? VIOLET
                          : BODY,
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
    </section>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingContent />
    </Suspense>
  );
}
