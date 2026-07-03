import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";
import { currentUser } from "@/lib/auth/server";
import { LoginForm } from "./login-form";
import { AuthScorePanel } from "./auth-score-panel";

export const metadata: Metadata = buildMetadata({
  title: "Log in",
  description: "Sign in to ReachKit with a magic link — no password needed.",
  path: "/login",
});

// Resolving `next` reads searchParams and the session reads cookies (both
// dynamic) — isolate them in a Suspense boundary so the rest of the card still
// prerenders (cacheComponents). Already-authed visitors bounce straight to the
// app instead of seeing a sign-in form for an account they're signed in to.
async function LoginFormWithNext({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, viewer] = await Promise.all([searchParams, currentUser()]);
  const safeNext = next && next.startsWith("/") ? next : undefined;
  if (viewer) redirect(safeNext ?? "/app");
  return <LoginForm next={safeNext} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <main
      className="grid min-h-dvh grid-cols-1 lg:grid-cols-2"
      aria-label="Log in"
      style={{ background: "var(--c-surface)", fontFamily: "var(--font-sans)" }}
    >
      {/* ── Form column ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-(--spacing-content-x) py-(--spacing-section-y)">
        <div style={{ width: "100%", maxWidth: 384 }}>
          <div style={{ marginBottom: 32, display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--c-ink)", margin: 0 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--c-muted)", margin: 0 }}>
              Enter your email and we&apos;ll send you a magic link to sign in.
            </p>
          </div>

          <Suspense fallback={<LoginForm />}>
            <LoginFormWithNext searchParams={searchParams} />
          </Suspense>

          <p style={{ marginTop: 32, fontSize: 14, color: "var(--c-muted)" }}>
            New to ReachKit?{" "}
            <Link href="/scan" style={{ fontWeight: 600, color: "var(--c-action)", textDecoration: "none" }}>
              Start a free scan →
            </Link>
          </p>
        </div>
      </div>

      {/* ── Violet score-card panel (decorative; hidden on mobile) ───────── */}
      <AuthScorePanel />
    </main>
  );
}
