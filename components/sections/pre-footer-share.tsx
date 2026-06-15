/**
 * PreFooterShare — §21.1 marketing section (principle #4: end on a footer
 * people want to share).
 *
 * 97% of visitors won't buy — but they might share. ReachKit's whole GTM is a
 * score-badge share loop, so the last thing before the legal footer is a
 * memorable, screenshot-friendly closer that invites the share.
 *
 * Server component, on design tokens.
 */

import Link from "next/link";

export function PreFooterShare() {
  return (
    <section
      className="px-(--spacing-content-x) py-20 text-center"
      style={{ background: "var(--fill-subtle)" }}
      aria-label="Share your score"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
        <p
          className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
          style={{ color: "var(--color-fg)", lineHeight: 1.15 }}
        >
          Run your scan. Share your score.
          <br />
          Watch who finally shows up.
        </p>
        <p className="max-w-md text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
          Every shared score is how the next founder finds the gap in their own listing.
        </p>
        <Link
          href="/"
          className="mt-1 inline-flex h-11 items-center rounded-lg px-6 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px motion-reduce:transform-none"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
        >
          Scan my product →
        </Link>
      </div>
    </section>
  );
}
