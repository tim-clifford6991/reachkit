/**
 * Billing page — thin shell placeholder.
 *
 * Task 21 (E4) builds the full billing + upgrade UI with Stripe Checkout.
 * This stub keeps the nav entry active. Data-fetching in Suspense per Next.js 16.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { Skeleton } from "@/components/ui/skeleton";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Billing", path: "/app/billing" });

// ---------------------------------------------------------------------------
// Data-fetching component
// ---------------------------------------------------------------------------

async function BillingContent() {
  const viewer = await currentUser();
  if (!viewer) redirect("/");

  const entitlements = await entitlementsFor(viewer.user.id);
  const tier = entitlements.active ? entitlements.tier : "free";
  const tierLabel =
    tier === "growth" ? "Growth" : tier === "solo" ? "Solo" : "Free";

  return (
    <div className="space-y-8">
      {/* Current plan */}
      <section
        aria-labelledby="billing-plan-heading"
        className="rounded-xl border"
        style={{
          borderColor: "oklch(1 0 0 / 0.09)",
          background: "var(--color-surface)",
        }}
      >
        <div className="px-5 py-5">
          <h2
            id="billing-plan-heading"
            className="mb-3 text-sm font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            Current plan
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-base font-medium" style={{ color: "var(--color-fg)" }}>
              {tierLabel}
            </span>
            {entitlements.active && (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                style={{
                  background: "var(--color-success-subtle)",
                  color: "var(--color-success)",
                  border: "1px solid oklch(0.72 0.17 155 / 0.3)",
                }}
              >
                Active
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Placeholder */}
      <div
        className="rounded-xl border px-8 py-10 text-center"
        style={{
          borderColor: "var(--color-accent-900)",
          background: "oklch(0.60 0.18 255 / 0.05)",
        }}
      >
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Coming in this build
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Full Stripe billing management, plan upgrade/downgrade, and invoice history.
          Building in Task 21.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-8 px-6 py-8">
      <div>
        <p
          className="font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Account
        </p>
        <h1 className="mt-0.5 text-xl font-semibold" style={{ color: "var(--color-fg)" }}>
          Billing
        </h1>
      </div>

      <Suspense fallback={<BillingSkeleton />}>
        <BillingContent />
      </Suspense>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "oklch(1 0 0 / 0.09)", background: "var(--color-surface)" }}
    >
      <Skeleton className="mb-3 h-4 w-28" />
      <Skeleton className="h-5 w-16" />
    </div>
  );
}
