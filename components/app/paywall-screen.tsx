"use client";

/**
 * PaywallScreen — the hard paid gate for the entire /app workspace.
 *
 * ReachKit is payment-first: an account normally only exists AFTER Stripe
 * checkout, so anyone hitting /app without an active subscription is either a
 * canceled/paused subscriber, a webhook still in flight seconds after payment,
 * or a stray unpaid account. None of them see the app: the layout renders THIS
 * instead of the shell (children are never rendered, so no intel work runs for
 * non-payers), and onboarding can only ever begin behind it.
 *
 * The webhook race (user lands from checkout before the subscription webhook
 * commits) self-heals: we refresh the server layout a few times over the first
 * seconds; the moment entitlements go active the workspace renders in place.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckoutButton } from "@/components/app/checkout-button";

const SG = "var(--font-display)", PJ = "var(--font-sans)", JM = "var(--font-mono)";

export function PaywallScreen({
  variant,
  hasBillingAccount,
}: {
  /** "resume" = lapsed/canceled subscriber (data intact); "activate" = never paid. */
  variant: "resume" | "activate";
  /** Show the Stripe-portal button only when a Stripe customer exists. */
  hasBillingAccount: boolean;
}) {
  const router = useRouter();

  // Webhook-race self-heal: re-render the server layout at 3s/6s/10s/15s after
  // mount. If the user just paid, entitlements flip active and the app appears.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    timers.current = [3000, 6000, 10000, 15000].map((ms) =>
      setTimeout(() => router.refresh(), ms),
    );
    return () => timers.current.forEach(clearTimeout);
  }, [router]);

  const openPortal = async () => {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (res.ok && data?.url) window.location.href = data.url;
    } catch {
      /* stay on the paywall — nothing to navigate to */
    }
  };

  const isResume = variant === "resume";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        overflowY: "auto",
        background: "var(--c-bg2)",
        fontFamily: PJ,
        color: "var(--c-ink)",
      }}
    >
      <form action="/auth/signout" method="post" style={{ position: "fixed", top: 14, right: 18 }}>
        <button
          type="submit"
          style={{
            background: "transparent", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)",
            padding: "6px 12px", fontFamily: PJ, fontSize: 12, fontWeight: 500, color: "var(--c-muted)", cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </form>

      <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 20px" }}>
        <div
          style={{
            width: "min(560px, 100%)",
            background: "var(--c-surface)",
            border: "1px solid var(--c-line)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "rgba(20,19,26,0.10) 0px 18px 50px -12px, rgba(20,19,26,0.05) 0px 4px 14px",
            padding: "34px 36px 32px",
            textAlign: "center",
          }}
        >
          <p style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>
            {isResume ? "Plan paused" : "Paid workspace"}
          </p>
          <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.5rem, 3vw, 1.9rem)", letterSpacing: "-0.02em", lineHeight: 1.15, margin: "12px 0 0" }}>
            {isResume ? "Your engine is paused — your data isn't." : "Activate your workspace"}
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--c-muted)", margin: "12px auto 0", maxWidth: 420 }}>
            {isResume
              ? "Your score history, competitor set, and action queue are all intact. Resume your plan and the weekly engine picks up right where it stopped."
              : "The dashboard, weekly action queue, and score tracking are part of the paid engine. Activate a plan to open your workspace — it takes one click."}
          </p>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 24 }}>
            <CheckoutButton
              plan="solo"
              fallbackHref="/app/billing"
              style={{
                background: "var(--c-action)", color: "#fff", border: "none", borderRadius: "var(--radius-md)",
                padding: "12px 28px", fontFamily: PJ, fontSize: 14.5, fontWeight: 600, cursor: "pointer", minWidth: 220,
              }}
            >
              {isResume ? "Resume plan" : "Activate — Solo $59/mo"}
            </CheckoutButton>
            {hasBillingAccount && (
              <button
                type="button"
                onClick={openPortal}
                style={{
                  background: "transparent", border: "1px solid var(--c-line)", borderRadius: "var(--radius-md)",
                  padding: "10px 22px", fontFamily: PJ, fontSize: 13, fontWeight: 500, color: "var(--c-muted)", cursor: "pointer", minWidth: 220,
                }}
              >
                Manage billing
              </button>
            )}
          </div>

          <p style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-faint)", margin: "22px 0 0" }}>
            Just paid? This unlocks automatically in a few seconds.
          </p>
          <p style={{ fontSize: 12.5, color: "var(--c-faint)", margin: "6px 0 0" }}>
            Questions? <a href="mailto:hello@reachkit.app" style={{ color: "var(--c-muted)" }}>hello@reachkit.app</a>
          </p>
        </div>
      </div>
    </div>
  );
}
