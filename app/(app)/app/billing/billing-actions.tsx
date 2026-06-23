"use client";

/**
 * BillingActions — client component for checkout/portal redirects (Task 21a).
 *
 * Handles:
 *  - Paid users: "Manage billing" → POST /api/billing/portal → redirect
 *  - Free/solo users: Upgrade buttons → POST /api/billing/checkout → redirect
 *  - ?upgraded=1 search param → success toast
 *  - ?billing=demo → fixture note
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { Tier } from "@/lib/billing/tiers";

type ButtonState = "idle" | "loading" | "error";

// ---------------------------------------------------------------------------
// Upgrade button (checkout)
// ---------------------------------------------------------------------------

function UpgradeButton({
  plan,
  label,
  price,
  highlighted,
}: {
  plan: "solo" | "growth";
  label: string;
  price: string;
  highlighted?: boolean;
}) {
  const [state, setState] = useState<ButtonState>("idle");

  const handleClick = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not start checkout. Please try again.");
        setState("error");
        return;
      }

      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
      // Keep loading state — user is navigating away
    } catch {
      toast.error("Network error — please try again.");
      setState("error");
    }
  }, [plan]);

  const isLoading = state === "loading";

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={() => void handleClick()}
      className="flex w-full flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left transition-all disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2"
      style={{
        borderColor: highlighted
          ? "var(--color-accent-900)"
          : "var(--hairline)",
        background: highlighted
          ? "oklch(0.56 0.205 285 / 0.07)"
          : "transparent",
      }}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--color-fg)" }}
        >
          {isLoading ? "Redirecting…" : `Upgrade to ${label}`}
        </span>
        <span
          className="font-mono text-sm font-semibold tabular-nums"
          style={{
            color: highlighted
              ? "var(--color-accent-400)"
              : "var(--color-muted)",
          }}
        >
          {price}
        </span>
      </div>
      <span
        className="font-mono text-[10px]"
        style={{ color: "var(--color-muted)" }}
      >
        {plan === "solo"
          ? "1 app · weekly queue · draft copy · monitoring"
          : "3 apps · higher quotas · 50 keyword rank depth"}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Manage billing button (portal)
// ---------------------------------------------------------------------------

function ManageBillingButton() {
  const [state, setState] = useState<ButtonState>("idle");

  const handleClick = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not open billing portal. Please try again.");
        setState("error");
        return;
      }

      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch {
      toast.error("Network error — please try again.");
      setState("error");
    }
  }, []);

  const isLoading = state === "loading";

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={() => void handleClick()}
      className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2"
      style={{
        borderColor: "var(--hairline-strong)",
        color: "var(--color-fg)",
        background: "var(--fill-subtle)",
      }}
    >
      {isLoading ? "Opening portal…" : "Manage billing"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface BillingActionsProps {
  tier: Tier;
  isActivePaid: boolean;
}

export function BillingActions({ tier, isActivePaid }: BillingActionsProps) {
  const searchParams = useSearchParams();

  // Handle Stripe success + demo flags
  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    const demo = searchParams.get("billing");

    if (upgraded === "1") {
      toast.success("Subscription activated — welcome to your action queue!");
    }
    if (demo === "demo") {
      toast.info(
        "Demo mode — billing controls are connected to Stripe test keys.",
        { duration: 6000 },
      );
    }
  }, [searchParams]);

  if (isActivePaid) {
    return (
      <div
        className="rounded-xl border px-7 py-4"
        style={{
          borderColor: "var(--hairline)",
          background: "var(--color-surface)",
        }}
      >
        <p
          className="mb-3 font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Billing management
        </p>
        <p
          className="mb-4 text-sm"
          style={{ color: "var(--color-muted)" }}
        >
          Update your payment method, view invoices, or cancel your
          subscription via the Stripe portal.
        </p>
        <ManageBillingButton />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border px-7 py-6"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
      }}
    >
      <p
        className="mb-1 font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        Upgrade your plan
      </p>
      <p
        className="mb-4 text-sm"
        style={{ color: "var(--color-muted)" }}
      >
        Turn your report into a weekly engine — action queue, draft copy,
        score tracking, and verification.
      </p>

      <div className="space-y-2">
        <UpgradeButton
          plan="solo"
          label="Solo"
          price="$59/mo"
          highlighted={tier === "free"}
        />
        {tier === "free" && (
          <UpgradeButton plan="growth" label="Growth" price="$129/mo" />
        )}
        {tier === "solo" && (
          <UpgradeButton plan="growth" label="Growth" price="$129/mo" highlighted />
        )}
      </div>

      <p
        className="mt-3 text-center font-mono text-[10px]"
        style={{ color: "var(--color-muted)" }}
      >
        7-day free trial. Cancel any time. No lock-in. Stripe-secured checkout.
      </p>
    </div>
  );
}
