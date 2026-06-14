import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Affiliate program",
  description:
    "Earn recurring commission recommending ReachKit to the founders and indie hackers in your audience.",
  path: "/affiliates",
});

const POINTS = [
  {
    title: "Recurring commission",
    body: "Earn a share of every subscription you refer, for as long as they stay — not just the first month.",
  },
  {
    title: "Made to convert",
    body: "A free scan is a genuinely useful first touch, so your audience gets value before they ever pay.",
  },
  {
    title: "Built for creators",
    body: "Perfect if you write for, build for, or advise solo founders, indie hackers and app makers.",
  },
];

export default function AffiliatesPage() {
  return (
    <main
      className="mx-auto max-w-2xl px-(--spacing-content-x) pb-(--spacing-section-y) pt-20 sm:pt-28"
      aria-label="ReachKit affiliate program"
    >
      <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
        Affiliate program
      </p>
      <h1 className="mt-3 text-4xl sm:text-5xl" style={{ color: "var(--color-fg)", lineHeight: 1.08 }}>
        Get paid to help founders get found
      </h1>
      <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--color-muted)" }}>
        We&apos;re opening a referral program for creators and consultants in the indie-founder
        space. Recurring commission, honest product, no spammy gimmicks.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {POINTS.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border p-6 shadow-[var(--elevation-sm),var(--edge-highlight)]"
            style={{ borderColor: "var(--hairline)", background: "var(--gradient-surface)" }}
          >
            <h2 className="text-base font-semibold" style={{ color: "var(--color-fg)" }}>
              {p.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
              {p.body}
            </p>
          </div>
        ))}
      </div>

      <div
        className="mt-10 flex flex-col items-start gap-3 rounded-2xl border p-7 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "var(--color-accent-900)", background: "var(--color-accent-subtle)" }}
      >
        <p className="text-sm" style={{ color: "var(--color-fg)" }}>
          Want in early? Email us and we&apos;ll add you when the program opens.
        </p>
        <a
          href="mailto:hello@reachkit.app?subject=ReachKit%20affiliate%20program"
          className="inline-flex h-11 shrink-0 items-center rounded-lg px-5 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px motion-reduce:transform-none"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
        >
          Join the waitlist
        </a>
      </div>
    </main>
  );
}
