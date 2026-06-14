import type { Metadata } from "next";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "Why ReachKit exists: a discoverability engine that gives solo founders a scored report and a weekly, verified action plan — without an agency.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <main
      className="mx-auto max-w-2xl px-(--spacing-content-x) pb-(--spacing-section-y) pt-20 sm:pt-28"
      aria-label="About ReachKit"
    >
      <p
        className="font-mono text-[10px] uppercase tracking-widest"
        style={{ color: "var(--color-accent-400)" }}
      >
        About
      </p>
      <h1
        className="mt-3 text-4xl sm:text-5xl"
        style={{ color: "var(--color-fg)", lineHeight: 1.08 }}
      >
        Built for founders who ship, not agencies who bill
      </h1>

      <div
        className="mt-8 flex flex-col gap-5 text-lg leading-relaxed"
        style={{ color: "var(--color-muted)" }}
      >
        <p>
          Most products don&apos;t fail because they&apos;re bad. They fail because nobody can find
          them. The people who&apos;d love your app are searching — they just land on someone
          else&apos;s listing instead of yours.
        </p>
        <p>
          ReachKit exists to close that gap. Paste a URL and you get a Discoverability Score, an
          honest read on who your page actually speaks to, the searches you&apos;re invisible for,
          and a ranked list of fixes — grounded in your live page, not generic advice. Then a weekly
          engine keeps you moving and verifies each change actually shipped.
        </p>
        <p>
          It&apos;s made by{" "}
          <span style={{ color: "var(--color-fg)", fontWeight: 500 }}>Tim Clifford</span>, a solo
          founder who got tired of distribution being a black box you either ignore or pay an agency
          a fortune to manage. The goal is simple: make getting found a thing you can do yourself, a
          little every week.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link
          href="/scan"
          className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold shadow-[var(--elevation-glow)] transition-transform hover:-translate-y-px motion-reduce:transform-none"
          style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
        >
          Scan your product
        </Link>
        <Link
          href="/teardowns"
          className="inline-flex h-11 items-center rounded-lg border px-5 text-sm font-medium transition-colors hover:bg-secondary"
          style={{ borderColor: "var(--hairline)", color: "var(--color-fg)" }}
        >
          Read a teardown
        </Link>
      </div>
    </main>
  );
}
