"use client";

import { useEffect } from "react";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console / any attached error reporter.
    console.error(error);
  }, [error]);

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: "var(--color-bg)", color: "var(--color-fg)" }}
    >
      <LogoMark size={44} />
      <p
        className="font-mono text-xs uppercase tracking-widest"
        style={{ color: "var(--color-danger)" }}
      >
        Something went wrong
      </p>
      <h1
        className="text-4xl sm:text-5xl"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "var(--tracking-display)", lineHeight: 1.05 }}
      >
        We hit an unexpected error
      </h1>
      <p className="max-w-md text-lg leading-relaxed" style={{ color: "var(--color-muted)" }}>
        This one&apos;s on us. Try again — if it keeps happening, head back home and give it a moment.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px motion-reduce:transform-none"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-secondary"
          style={{ borderColor: "var(--hairline)", color: "var(--color-fg)" }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
