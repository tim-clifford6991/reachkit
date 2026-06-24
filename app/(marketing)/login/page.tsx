import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";
import { LoginForm } from "./login-form";
import { AuthScorePanel } from "./auth-score-panel";

export const metadata: Metadata = buildMetadata({
  title: "Log in",
  description: "Sign in to ReachKit with a magic link — no password needed.",
  path: "/login",
});

// Resolving `next` reads searchParams (dynamic) — isolate it in a Suspense
// boundary so the rest of the card still prerenders (cacheComponents).
async function LoginFormWithNext({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : undefined;
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
      style={{ background: "#fff" }}
    >
      {/* ── Form column ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-(--spacing-content-x) py-(--spacing-section-y)">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col gap-2">
            <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.02em", color: "#14131A" }}>
              Welcome back
            </h1>
            <p className="text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
              Enter your email and we&apos;ll send you a magic link to sign in.
            </p>
          </div>

          <Suspense fallback={<LoginForm />}>
            <LoginFormWithNext searchParams={searchParams} />
          </Suspense>

          <p className="mt-8 text-sm" style={{ color: "var(--color-muted)" }}>
            New to ReachKit?{" "}
            <Link href="/scan" className="font-medium" style={{ color: "var(--color-accent-400)" }}>
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
