import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: "var(--color-bg)", color: "var(--color-fg)" }}
    >
      <LogoMark size={44} />
      <p
        className="font-mono text-xs uppercase tracking-widest"
        style={{ color: "var(--color-accent-400)" }}
      >
        404 — not found
      </p>
      <h1
        className="text-5xl sm:text-6xl"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "var(--tracking-display)", lineHeight: 1.05 }}
      >
        This page wandered off
      </h1>
      <p className="max-w-md text-lg leading-relaxed" style={{ color: "var(--color-muted)" }}>
        The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get you back on track.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px motion-reduce:transform-none"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
        >
          Back to home
        </Link>
        <Link
          href="/scan"
          className="inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-secondary"
          style={{ borderColor: "var(--hairline)", color: "var(--color-fg)" }}
        >
          Scan your product
        </Link>
      </div>
    </main>
  );
}
