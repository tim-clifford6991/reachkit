/**
 * /welcome — post-checkout bridge (payment-first funnel: Stripe → Email → Magic Link).
 *
 * Reached two ways:
 *   1. Stripe success_url right after checkout (no session yet) → "check your
 *      email for the login link" + resend.
 *   2. The magic link itself (→ /auth/confirm sets the session → /welcome) →
 *      now authenticated → forward to onboarding (if incomplete) or the dashboard.
 *
 * Account creation + scan linking happen webhook-side; this page never depends on
 * them — it only tells the user to check their email, or forwards once signed in.
 */

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/server";
import { env } from "@/lib/config/env";
import { stripeClient } from "@/lib/billing/stripe";
import { buildMetadata } from "@/lib/seo";
import { WelcomeResend } from "./welcome-resend";

export const metadata = buildMetadata({ title: "Welcome", path: "/welcome" });

export default function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; fixture?: string }>;
}) {
  return (
    <main className="mx-auto flex min-h-[70svh] max-w-md items-center px-4 py-12">
      <Suspense fallback={null}>
        <WelcomeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function WelcomeContent({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; fixture?: string }>;
}) {
  // Already signed in (arrived via the magic link) → forward.
  const viewer = await currentUser();
  if (viewer) {
    redirect(viewer.user.onboarded_at ? "/app" : "/app/onboarding");
  }

  const { session_id } = await searchParams;

  // Best-effort: surface the email Stripe collected so resend can pre-fill.
  let email: string | null = null;
  if (session_id && env.stripeSecretKey) {
    try {
      const session = await stripeClient().checkout.sessions.retrieve(session_id);
      email = session.customer_details?.email ?? session.customer_email ?? null;
    } catch {
      /* non-fatal — fall back to asking for the email on resend */
    }
  }

  return (
    <div
      className="w-full rounded-2xl border p-8 shadow-[var(--elevation-sm)]"
      style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}
    >
      <div
        className="mb-5 grid size-11 place-items-center rounded-full"
        style={{ background: "var(--color-success-subtle)", color: "var(--color-success)" }}
        aria-hidden
      >
        ✓
      </div>
      <p
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-accent-400)" }}
      >
        Subscription active
      </p>
      <h1 className="mt-1 text-xl font-semibold" style={{ color: "var(--color-fg)" }}>
        Check your email to log in
      </h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
        Your subscription is active. We&apos;ve sent a one-click login link
        {email ? (
          <>
            {" "}to <span style={{ color: "var(--color-accent-400)" }}>{email}</span>
          </>
        ) : (
          " to the email you used at checkout"
        )}
        . Open it to set up your dashboard — your full report is waiting.
      </p>

      <div className="mt-6">
        <WelcomeResend email={email} />
      </div>
    </div>
  );
}
