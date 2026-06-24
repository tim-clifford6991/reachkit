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
      style={{
        display: "flex",
        width: "100%",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        textAlign: "left",
        cursor: isLoading ? "default" : "pointer",
        opacity: isLoading ? 0.6 : 1,
        borderRadius: 10,
        padding: "12px 16px",
        border: highlighted ? `1.5px solid ${VIOLET}` : `1px solid ${CARD_BORDER}`,
        background: highlighted ? "var(--c-soft)" : "var(--c-surface)",
        transition: "all 0.15s ease",
      }}
    >
      <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontFamily: PJ, fontSize: 14, fontWeight: 600, color: INK }}>
          {isLoading ? "Redirecting…" : `Upgrade to ${label}`}
        </span>
        <span
          style={{
            fontFamily: JM,
            fontSize: 14,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: highlighted ? VIOLET : BODY,
          }}
        >
          {price}
        </span>
      </div>
      <span style={{ fontFamily: JM, fontSize: 11, color: FAINT }}>
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        border: `1px solid ${CARD_BORDER}`,
        padding: "10px 18px",
        fontFamily: PJ,
        fontSize: 14,
        fontWeight: 600,
        color: INK,
        background: "var(--c-surface)",
        cursor: isLoading ? "default" : "pointer",
        opacity: isLoading ? 0.6 : 1,
        transition: "all 0.15s ease",
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
      <div style={cardStyle}>
        <p style={{ ...eyebrowStyle, marginBottom: 12 }}>
          Billing management
        </p>
        <p style={{ fontSize: 14, color: BODY, marginBottom: 16 }}>
          Update your payment method, view invoices, or cancel your
          subscription via the Stripe portal.
        </p>
        <ManageBillingButton />
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <p style={{ ...eyebrowStyle, marginBottom: 4 }}>
        Upgrade your plan
      </p>
      <p style={{ fontSize: 14, color: BODY, marginBottom: 16 }}>
        Turn your report into a weekly engine — action queue, draft copy,
        score tracking, and verification.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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

      <p style={{ marginTop: 12, textAlign: "center", fontFamily: JM, fontSize: 11, color: FAINT }}>
        Cancel any time. No lock-in. Stripe-secured checkout.
      </p>
    </div>
  );
}
